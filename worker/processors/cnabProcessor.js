// worker/processors/cnabProcessor.js
// Processador de geração do arquivo de remessa bancária Itaú SISPAG (CNAB 240)

const cnabService = require('../../services/cnab_service');
const { supabaseAdmin } = require('../../api/utils/supabase');

async function processCnab({ tenant, batchId, paymentDate, todasGuias, log }) {
    log("🏦 Iniciando geração da remessa bancária Itaú SISPAG (CNAB 240)...");

    const dadosEmpresa = {
        cnpj: tenant.cnpj,
        razaoSocial: tenant.razao_social,
        agencia: tenant.bank_agency,
        conta: tenant.bank_account,
        dac: tenant.bank_dac
    };

    try {
        const resultadoCnab = cnabService.gerarRemessaSispag(dadosEmpresa, todasGuias, paymentDate);

        if (!resultadoCnab || !resultadoCnab.conteudo) {
            log("ℹ Nenhuma guia válida com código de barras disponível para inclusão no arquivo de remessa.");
            return { success: false, reason: "Sem guias com código de barras" };
        }

        log(`✔ Remessa gerada: ${resultadoCnab.totalGuias} guia(s) processada(s) | Total: R$ ${resultadoCnab.totalValor.toFixed(2)}.`);

        // Salva arquivo no Supabase Storage: [tenant_id]/remessas/[batch_id]_remessa.txt
        const storagePath = `${tenant.id}/remessas/${batchId}_remessa.txt`;
        const fileBuffer = Buffer.from(resultadoCnab.conteudo, 'utf8');

        const { error: uploadError } = await supabaseAdmin.storage
            .from('tenant-storage')
            .upload(storagePath, fileBuffer, {
                contentType: 'text/plain; charset=utf-8',
                upsert: true
            });

        if (uploadError) {
            log(`⚠ Falha no upload da remessa para o Storage: ${uploadError.message}`);
        } else {
            log("✔ Arquivo remessa.txt arquivado com sucesso no armazenamento seguro.");
        }

        return {
            success: true,
            storagePath,
            totalGuias: resultadoCnab.totalGuias,
            totalValor: resultadoCnab.totalValor
        };
    } catch (err) {
        log(`❌ Erro na geração da remessa CNAB: ${err.message}`);
        return { success: false, error: err.message };
    }
}

module.exports = {
    processCnab
};
