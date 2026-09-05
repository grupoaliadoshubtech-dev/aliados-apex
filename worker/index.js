// worker/index.js
// Ponto de entrada do serviço de processamento em segundo plano (Render Worker)

require('dotenv').config();
const { QUEUE_NAME, getBossInstance } = require('./queue');
const { processGnreBatch } = require('./processors/gnreProcessor');

console.log("==================================================");
console.log("🚀 Apex GNRE Worker Inicializando...");
console.log(`⏱ Data/Hora: ${new Date().toISOString()}`);
console.log("==================================================");

async function startWorker() {
    const boss = getBossInstance();

    if (!boss) {
        console.warn("⚠️ DATABASE_URL não configurada no ambiente. O Worker está aguardando configuração.");
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
    } catch (err) {
        console.error("❌ Falha fatal na inicialização do Worker:", err.message);
        process.exit(1);
    }
}

// Tratamento de encerramento seguro
async function shutdown() {
    console.log("\n🛑 Encerrando worker graciosamente...");
    const boss = getBossInstance();
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
