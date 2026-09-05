// worker/processors/gnreProcessor.js
// Processador de emissão fiscal GNRE e DUA-ES com mTLS e Proxy SEFAZ

const { supabaseAdmin } = require('../../api/utils/supabase');
const { getEncryptionKey, decrypt } = require('../../api/utils/encryption');
const parserService = require('../../services/parser_service');
const gnreService = require('../../services/gnre_service');
const duaEsService = require('../../services/dua_es_service');
const { processCnab } = require('./cnabProcessor');

/**
 * Processa um lote de notas fiscais
 * @param {Object} jobData { batchId, tenantId, files, paymentDate }
 */
async function processGnreBatch(jobData) {
    const { batchId, tenantId, files, paymentDate } = jobData;
    const logs = [];

    const log = (msg) => {
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const entry = `[${timestamp}] ${msg}`;
        logs.push(entry);
        console.log(`[Batch ${batchId}] ${entry}`);
    };

    try {
        log("🚀 Iniciando processamento do lote no Worker...");

        // Função auxiliar para atualização tolerante a schemas antigos sem a coluna 'logs'
        async function updateBatchSafe(fields) {
            const { error } = await supabaseAdmin.from('batches').update(fields).eq('id', batchId);
            if (error && error.message && error.message.includes('logs')) {
                const copy = { ...fields };
                delete copy.logs;
                await supabaseAdmin.from('batches').update(copy).eq('id', batchId);
            }
        }

        // 1. Atualiza status no banco para 'processing'
        await updateBatchSafe({ status: 'processing', logs });

        // 2. Busca dados atualizados do tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            throw new Error("Tenant não encontrado: " + (tenantError?.message || 'ID inválido'));
        }

        // 3. Inicializa agente mTLS e Proxy para a SEFAZ
        let agent = null;
        if (tenant.environment === 'producao') {
            log("🔍 Carregando certificado digital PFX do armazenamento seguro...");
            if (!tenant.pfx_filename) {
                throw new Error("Nenhum certificado digital PFX configurado para a empresa.");
            }

            const { data: pfxFile, error: downloadError } = await supabaseAdmin.storage
                .from('tenant-storage')
                .download(`${tenant.id}/certificados/${tenant.pfx_filename}`);

            if (downloadError || !pfxFile) {
                throw new Error("Não foi possível carregar o arquivo PFX do storage: " + (downloadError?.message || 'Arquivo ausente'));
            }

            const pfxBuffer = Buffer.from(await pfxFile.arrayBuffer());

            // REGRA: NUNCA logar a senha descriptografada
            log("🔓 Inicializando credenciais criptográficas em memória...");
            const key = getEncryptionKey(process.env.ENCRYPTION_KEY);
            const passphrase = decrypt(tenant.pfx_passphrase_encrypted, key);

            // REGRA 2: Cria o agente com suporte a HttpsProxyAgent para evitar bloqueio da SEFAZ
            log("⚙ Inicializando agente mTLS com suporte a Proxy Nacional SEFAZ...");
            agent = gnreService.createHttpsAgent({ pfxBuffer, passphrase });
        } else {
            log("🧪 Ambiente SIMULADO ativo. A transmissão será executada em modo de teste.");
        }

        // 4. Parse dos XMLs de NF-e
        log(`📄 Lendo ${files.length} arquivo(s) XML...`);
        const notasFiscais = [];
        for (const f of files) {
            try {
                const dadosNfe = parserService.extrairDadosNfeXML(f.content);
                dadosNfe.nomeArquivoOriginal = f.filename;
                notasFiscais.push(dadosNfe);
                log(`   ✔ NF Nº ${dadosNfe.documentoOrigem} (UF: ${dadosNfe.ufFavorecida}, DIFAL: R$ ${dadosNfe.valor}) validada.`);
            } catch (err) {
                log(`   ⚠ XML ${f.filename} ignorado: ${err.message}`);
            }
        }

        if (notasFiscais.length === 0) {
            throw new Error("Nenhum arquivo XML de NF-e válido para processamento no lote.");
        }

        // Ajusta datas de pagamento / vencimento
        const hoje = new Date().toISOString().split('T')[0];
        const dataAlvo = paymentDate || hoje;
        for (const nota of notasFiscais) {
            if (nota.ufFavorecida === 'ES') {
                const dateObj = new Date();
                const currentYear = String(dateObj.getFullYear());
                const currentMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
                if (nota.anoApuracao !== currentYear || nota.mesApuracao !== currentMonth) {
                    nota.dataVencimento = hoje;
                    nota.dataPagamento = hoje;
                    continue;
                }
            }
            nota.dataVencimento = dataAlvo;
            nota.dataPagamento = dataAlvo;
        }

        // 5. Separa notas por portal fiscal (ES vs SP vs GNRE Nacional)
        const notasES = notasFiscais.filter(n => n.ufFavorecida === 'ES');
        const notasSP = notasFiscais.filter(n => n.ufFavorecida === 'SP');
        const notasGnre = notasFiscais.filter(n => n.ufFavorecida !== 'ES' && n.ufFavorecida !== 'SP');

        const todasGuias = [];
        const recibosEfetuados = [];

        const dadosEmpresa = {
            cnpj: tenant.cnpj,
            razaoSocial: tenant.razao_social,
            agencia: tenant.bank_agency,
            conta: tenant.bank_account,
            dac: tenant.bank_dac
        };

        // 5.1 Processamento SEFAZ-ES (DUA-ES)
        if (notasES.length > 0) {
            log(`⚡ Transmitindo ${notasES.length} guia(s) DUA-ES para a SEFAZ-ES...`);
            for (const nota of notasES) {
                try {
                    const dadosDua = {
                        cnpjEmitente: tenant.cnpj,
                        chaveAcesso: nota.documentoOrigemChave,
                        numNfe: nota.documentoOrigem,
                        valor: nota.valor,
                        dataVencimento: nota.dataVencimento,
                        dataPagamento: nota.dataPagamento,
                        cpfDestinatario: nota.destinatarioCnpjCpf,
                        nomeDestinatario: nota.destinatarioNome,
                        municipioDestinatario: nota.destinatarioMunicipio
                    };

                    const resultadoDua = await duaEsService.transmitirEmissao(dadosDua, agent, tenant.environment);
                    if (resultadoDua && resultadoDua.codigoBarras) {
                        todasGuias.push({
                            documentoOrigem: nota.documentoOrigem,
                            ufFavorecida: 'ES',
                            valor: nota.valor,
                            codigoBarras: resultadoDua.codigoBarras,
                            linhaDigitavel: resultadoDua.linhaDigitavel || resultadoDua.codigoBarras,
                            dadosNfeOriginal: nota
                        });
                        log(`   ✔ DUA-ES emitido para NF ${nota.documentoOrigem} | Código de Barras: ${resultadoDua.codigoBarras}`);
                    }
                } catch (esErr) {
                    log(`   ❌ Erro ao emitir DUA-ES para NF ${nota.documentoOrigem}: ${esErr.message}`);
                }
            }
        }

        // 5.2 Processamento SP (Geração de Lote XML)
        if (notasSP.length > 0) {
            log(`ℹ ${notasSP.length} nota(s) com destino a SP identificadas.`);
        }

        // 5.3 Processamento Portal Nacional GNRE v2.00 (SEFAZ-PE)
        if (notasGnre.length > 0) {
            log(`📡 Enviando ${notasGnre.length} guia(s) ao Portal Nacional da GNRE (SEFAZ)...`);
            const resultadoEnvio = await gnreService.enviarLote(notasGnre, agent, 'PE', tenant.environment, dadosEmpresa);

            if (!resultadoEnvio.sucesso || !resultadoEnvio.recibo) {
                throw new Error("Rejeição SEFAZ no envio do lote: " + (resultadoEnvio.motivo || 'Sem recibo'));
            }

            const recibo = resultadoEnvio.recibo;
            recibosEfetuados.push(recibo);
            log(`✔ Lote aceito pela SEFAZ. Recibo: ${recibo}. Aguardando processamento da fila fiscal...`);

            // Consulta com retry
            let guiasConsultadas = null;
            let tentativas = 0;
            const maxTentativas = 6;

            while (tentativas < maxTentativas) {
                tentativas++;
                await new Promise(r => setTimeout(r, 4000));
                log(`   ⏳ Consultando resultado (Tentativa ${tentativas}/${maxTentativas})...`);
                
                guiasConsultadas = await gnreService.consultarLote(recibo, agent, 'PE', tenant.environment);
                if (guiasConsultadas && guiasConsultadas.statusLote !== 'processando') {
                    break;
                }
            }

            if (guiasConsultadas && guiasConsultadas.guias && guiasConsultadas.guias.length > 0) {
                for (const g of guiasConsultadas.guias) {
                    const nfeCorrespondente = notasGnre.find(n => n.documentoOrigem === g.documentoOrigem);
                    todasGuias.push({
                        documentoOrigem: g.documentoOrigem,
                        ufFavorecida: g.ufFavorecida,
                        valor: g.valor,
                        codigoBarras: g.codigoBarras,
                        linhaDigitavel: g.linhaDigitavel,
                        dadosNfeOriginal: nfeCorrespondente
                    });
                    log(`   ✔ Guia GNRE confirmada para NF ${g.documentoOrigem} (${g.ufFavorecida}) | R$ ${g.valor}`);
                }
            } else if (guiasConsultadas && guiasConsultadas.motivoRejeicao) {
                log(`   ⚠ Alerta SEFAZ: ${guiasConsultadas.motivoRejeicao}`);
            }
        }

        // 6. Geração dos HTMLs das Guias e Upload no Supabase Storage
        log("🎨 Renderizando guias e salvando no Supabase Storage...");
        for (const guia of todasGuias) {
            try {
                const htmlGuia = gnreService.exportarGuiaHtml(dadosEmpresa, guia, guia.dadosNfeOriginal);
                const storagePath = `${tenant.id}/guias/${guia.documentoOrigem}_${guia.ufFavorecida}.html`;

                await supabaseAdmin.storage
                    .from('tenant-storage')
                    .upload(storagePath, Buffer.from(htmlGuia, 'utf8'), {
                        contentType: 'text/html; charset=utf-8',
                        upsert: true
                    });

                guia.storage_path = storagePath;
            } catch (htmlErr) {
                log(`   ⚠ Falha ao gerar HTML da guia NF ${guia.documentoOrigem}: ${htmlErr.message}`);
            }
        }

        // 7. Persistência das guias no Supabase
        if (todasGuias.length > 0) {
            const guidesDb = todasGuias.map(g => ({
                tenant_id: tenant.id,
                batch_id: batchId,
                nf_number: g.documentoOrigem,
                uf: g.ufFavorecida,
                value: g.valor,
                barcode: g.codigoBarras,
                line_digitizable: g.linhaDigitavel,
                storage_path: g.storage_path || null
            }));

            const { error: insertGuidesError } = await supabaseAdmin
                .from('guides')
                .insert(guidesDb);

            if (insertGuidesError) {
                log(`⚠ Falha ao inserir guias no banco: ${insertGuidesError.message}`);
            }

            // 8. Medição de Uso e Incremento de Cotas
            const currentYearMonth = hoje.substring(0, 7); // 'YYYY-MM'
            
            // Incrementa contador do tenant
            await supabaseAdmin.rpc('increment_tenant_usage', {
                p_tenant_id: tenant.id,
                p_count: todasGuias.length
            }).catch(async () => {
                // Fallback via update direto caso RPC não exista ainda
                const novoTotal = (tenant.used_this_month || 0) + todasGuias.length;
                await supabaseAdmin
                    .from('tenants')
                    .update({ used_this_month: novoTotal })
                    .eq('id', tenant.id);
            });

            // Registra na tabela usage_meter
            await supabaseAdmin
                .from('usage_meter')
                .insert({
                    tenant_id: tenant.id,
                    batch_id: batchId,
                    year_month: currentYearMonth,
                    guides_count: todasGuias.length
                }).catch(e => log(`⚠ Falha ao registrar usage_meter: ${e.message}`));
        }

        // 9. Processador Bancário Itaú (CNAB 240)
        await processCnab({
            tenant,
            batchId,
            paymentDate,
            todasGuias,
            log
        });

        // 10. Finaliza o lote com Sucesso
        log("🎉 Lote processado com sucesso!");
        await updateBatchSafe({
            status: 'sucesso',
            receipt: recibosEfetuados.join(', ') || null,
            logs
        });

        return { success: true, totalGuias: todasGuias.length };

    } catch (err) {
        log(`❌ Falha no processamento: ${err.message}`);
        const { error } = await supabaseAdmin
            .from('batches')
            .update({
                status: 'erro',
                error_message: err.message,
                logs
            })
            .eq('id', batchId);

        if (error && error.message && error.message.includes('logs')) {
            await supabaseAdmin
                .from('batches')
                .update({
                    status: 'erro',
                    error_message: err.message
                })
                .eq('id', batchId);
        }

        throw err;
    }
}

module.exports = {
    processGnreBatch
};
