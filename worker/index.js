// worker/index.js
// Ponto de entrada do serviço de processamento em segundo plano (Render Worker)

require('dotenv').config();
const { QUEUE_NAME, getBossInstance } = require('./queue');
const { processGnreBatch } = require('./processors/gnreProcessor');
const { supabaseAdmin } = require('../api/utils/supabase');
const { JOB_NAME: EXPIRE_TRIALS_JOB, handler: expireTrialsHandler } = require('./jobs/expire_trials');

console.log("==================================================");
console.log("🚀 Apex GNRE Worker Inicializando...");
console.log(`⏱ Data/Hora: ${new Date().toISOString()}`);
console.log("==================================================");

let isPolling = false;
let pollingInterval = null;

/**
 * Fallback de polling para desenvolvimento local quando DATABASE_URL não está configurada
 */
async function startLocalPollingFallback() {
    console.log("🔄 Modo de Fallback Local Ativado: monitorando tabela 'batches' no Supabase a cada 3s...");

    pollingInterval = setInterval(async () => {
        if (isPolling) return;
        isPolling = true;

        try {
            const { data: queuedBatches, error } = await supabaseAdmin
                .from('batches')
                .select('*')
                .eq('status', 'queued')
                .order('created_at', { ascending: true })
                .limit(1);

            if (!error && queuedBatches && queuedBatches.length > 0) {
                const batch = queuedBatches[0];
                console.log(`\n📥 [Worker Poller] Lote detectado na fila: ${batch.id} (Tenant: ${batch.tenant_id})`);

                // Busca arquivos salvos no storage sob [tenant_id]/temp_xmls/[batch_id]/
                const storageFolder = `${batch.tenant_id}/temp_xmls/${batch.id}`;
                const { data: fileList } = await supabaseAdmin.storage
                    .from('tenant-storage')
                    .list(storageFolder);

                let files = [];
                if (fileList && fileList.length > 0) {
                    for (const item of fileList) {
                        const { data: fileBlob } = await supabaseAdmin.storage
                            .from('tenant-storage')
                            .download(`${storageFolder}/${item.name}`);

                        if (fileBlob) {
                            const buffer = Buffer.from(await fileBlob.arrayBuffer());
                            files.push({
                                filename: item.name,
                                content: buffer.toString('utf8')
                            });
                        }
                    }
                }

                if (files.length === 0) {
                    // Tenta ler do diretório local teste se existir
                    console.log("ℹ Buscando arquivos no payload local...");
                }

                await processGnreBatch({
                    batchId: batch.id,
                    tenantId: batch.tenant_id,
                    files,
                    paymentDate: null
                });

                console.log(`✔ [Worker Poller] Lote ${batch.id} processado com sucesso!`);
            }
        } catch (pollErr) {
            console.error("❌ [Worker Poller Error]:", pollErr.message);
        } finally {
            isPolling = false;
        }
    }, 3000);
}

async function startWorker() {
    const boss = await getBossInstance();

    if (!boss) {
        console.warn("⚠️ DATABASE_URL não configurada no ambiente.");
        console.log("💡 Para produção no Render, defina DATABASE_URL com Session Pooler (porta 5432).");
        await startLocalPollingFallback();
        return;
    }

    try {
        await boss.start();
        console.log("✔ Conexão com pg-boss estabelecida com sucesso!");

        // Registra o processador na fila com concorrência configurada
        await boss.work(QUEUE_NAME, { batchSize: 1 }, async (jobs) => {
            const job = Array.isArray(jobs) ? jobs[0] : jobs;
            console.log(`\n📥 [Worker] Recebido Job ID ${job.id} para o Lote ${job.data?.batchId}`);
            
            try {
                const result = await processGnreBatch(job.data);
                console.log(`✔ [Worker] Job ID ${job.id} concluído com sucesso!`);
                return result;
            } catch (err) {
                console.error(`❌ [Worker] Erro ao processar Job ID ${job.id}:`, err.message);
                throw err; // Permite ao pg-boss executar retry conforme configurado
            }
        });

        console.log(`👂 Worker ouvindo a fila '${QUEUE_NAME}'. Aguardando novos lotes...`);

        // ─── Jobs Agendados ───────────────────────────────────────
        // Expira trials todos os dias às 09:00 (horário UTC)
        await boss.schedule(EXPIRE_TRIALS_JOB, '0 12 * * *', {}, { tz: 'America/Sao_Paulo' });
        await boss.work(EXPIRE_TRIALS_JOB, async (jobs) => {
            const job = Array.isArray(jobs) ? jobs[0] : jobs;
            console.log(`\n🕘 [Worker] Executando job agendado: ${EXPIRE_TRIALS_JOB}`);
            try {
                const result = await expireTrialsHandler(job);
                console.log(`✔ [${EXPIRE_TRIALS_JOB}] Concluído:`, result);
                return result;
            } catch (err) {
                console.error(`❌ [${EXPIRE_TRIALS_JOB}] Erro:`, err.message);
                throw err;
            }
        });
        console.log(`⏰ Job '${EXPIRE_TRIALS_JOB}' agendado para 09:00 BRT diário.`);
    } catch (err) {
        console.error("❌ Falha na inicialização do pg-boss:", err.message);
        console.log("🔄 Alternando para modo de polling local...");
        await startLocalPollingFallback();
    }
}

// Tratamento de encerramento seguro
async function shutdown() {
    console.log("\n🛑 Encerrando worker graciosamente...");
    if (pollingInterval) clearInterval(pollingInterval);
    const boss = await getBossInstance();
    if (boss) {
        try {
            await boss.stop({ graceful: true, timeout: 10000 });
            console.log("✔ pg-boss parado com sucesso.");
        } catch (e) {
            console.error("Erro ao parar pg-boss:", e.message);
        }
    }
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startWorker();
