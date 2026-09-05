// worker/queue.js
// Gerenciador de filas pg-boss para execução assíncrona desacoplada da API

const PgBoss = require('pg-boss');

const QUEUE_NAME = 'process-gnre-batch';

/**
 * Sanitiza a connection string para garantir o uso do Session Pooler (porta 5432) do Supabase.
 * O Transaction Pooler (porta 6543) NÃO suporta LISTEN/NOTIFY nem advisory locks necessários para pg-boss.
 */
function getDatabaseUrl() {
    let url = process.env.DATABASE_URL;
    if (!url) {
        return null;
    }

    if (url.includes(':6543')) {
        console.warn("⚠️ [Queue] DATABASE_URL configurada na porta 6543 (Transaction Pooler). Corrigindo automaticamente para a porta 5432 (Session Pooler)...");
        url = url.replace(':6543', ':5432');
    }

    return url;
}

let bossInstance = null;

function getBossInstance() {
    if (!bossInstance) {
        const dbUrl = getDatabaseUrl();
        if (!dbUrl) {
            console.warn("⚠️ [Queue] DATABASE_URL não definida. pg-boss em modo inativo.");
            return null;
        }

        bossInstance = new PgBoss({
            connectionString: dbUrl,
            application_name: 'apex-gnre-worker',
            max: 5, // Limite de conexões no pool
            // Opções do pg-boss
            retentionDays: 7,
            archiveCompletedAfterSeconds: 3600
        });

        bossInstance.on('error', (err) => {
            console.error("❌ [pg-boss Error]:", err.message);
        });
    }

    return bossInstance;
}

/**
 * Envia um lote para a fila de processamento
 */
async function enqueueBatch(jobData) {
    const boss = getBossInstance();
    if (!boss) {
        console.warn("⚠️ [Queue] Fila pg-boss offline (sem DATABASE_URL). O lote foi registrado no banco com status 'queued'.");
        return null;
    }

    try {
        await boss.start();
        const jobId = await boss.send(QUEUE_NAME, jobData, {
            retryLimit: 3,
            retryDelay: 30, // segundos
            expireInMinutes: 30
        });
        console.log(`📥 [Queue] Lote ${jobData.batchId} enfileirado no pg-boss (Job ID: ${jobId})`);
        return jobId;
    } catch (err) {
        console.error("❌ [Queue] Falha ao enfileirar job:", err.message);
        throw err;
    }
}

module.exports = {
    QUEUE_NAME,
    getDatabaseUrl,
    getBossInstance,
    enqueueBatch
};
