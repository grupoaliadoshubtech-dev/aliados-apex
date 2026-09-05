// api/routes/batches.js
// Rotas de processamento de lotes fiscais, consultas de status e downloads

const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const { supabaseAdmin } = require('../utils/supabase');
const { requireAuth, requireActiveSubscription } = require('../middlewares/auth');
const { enqueueBatch } = require('../../worker/queue');
const { processGnreBatch } = require('../../worker/processors/gnreProcessor');

// Limite rigoroso: máximo 50 XMLs por lote (Ajuste 4)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB por arquivo
        files: 50 // Máximo 50 arquivos
    }
});

// Middleware de upload com tratamento de erro amigável para limite de arquivos
const uploadBatchFiles = (req, res, next) => {
    upload.array('files', 50)(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: "Limite de upload excedido. Máximo permitido: 50 arquivos XML por lote." });
        }
        if (err) {
            return res.status(400).json({ error: "Erro no upload dos arquivos: " + err.message });
        }
        next();
    });
};

/**
 * POST /api/batch/process
 * Recebe até 50 XMLs de NF-e, cria o registro no Supabase como 'queued' e envia para a fila
 */
router.post('/process', requireAuth, requireActiveSubscription, uploadBatchFiles, async (req, res) => {
    const files = req.files;
    const paymentDate = req.body.paymentDate || null;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo XML de NF-e foi enviado." });
    }

    if (files.length > 50) {
        return res.status(400).json({ error: "Limite de upload excedido. Máximo permitido: 50 arquivos XML por lote." });
    }

    try {
        const tenant = req.tenant;

        // 1. Cria o registro do lote com status 'queued'
        const initialLog = `[${new Date().toLocaleTimeString('pt-BR')}] Lote de ${files.length} nota(s) recebido e enfileirado com sucesso.`;
        const { data: batch, error: batchError } = await supabaseAdmin
            .from('batches')
            .insert({
                tenant_id: tenant.id,
                environment: tenant.environment || 'simulado',
                status: 'queued',
                logs: [initialLog]
            })
            .select()
            .single();

        if (batchError || !batch) {
            return res.status(500).json({ error: "Erro ao criar registro do lote: " + (batchError?.message || 'Falha no banco') });
        }

        // 2. Prepara os dados dos arquivos para o Worker
        const filesData = files.map(f => ({
            filename: f.originalname,
            content: f.buffer.toString('utf8')
        }));

        const jobPayload = {
            batchId: batch.id,
            tenantId: tenant.id,
            files: filesData,
            paymentDate
        };

        // 3. Envia para a fila pg-boss
        let enqueued = false;
        try {
            const jobId = await enqueueBatch(jobPayload);
            enqueued = !!jobId;
        } catch (queueErr) {
            console.warn("⚠️ Falha ao conectar no pg-boss:", queueErr.message);
        }

        // 4. Fallback de Desenvolvimento Local: Se pg-boss estiver offline, executa em background via setImmediate
        if (!enqueued) {
            console.log(`ℹ [Dev Fallback] Executando lote ${batch.id} localmente em segundo plano.`);
            setImmediate(async () => {
                try {
                    await processGnreBatch(jobPayload);
                } catch (procErr) {
                    console.error(`Erro no processamento do lote ${batch.id}:`, procErr.message);
                }
            });
        }

        return res.status(200).json({
            batchId: batch.id,
            status: 'queued',
            message: "Lote criado e enfileirado para processamento assíncrono.",
            totalFiles: files.length
        });

    } catch (err) {
        console.error("Erro em /api/batch/process:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/batch/status/:batchId
 * Retorna o status atual e os logs do lote para polling do frontend
 */
router.get('/status/:batchId', requireAuth, async (req, res) => {
    try {
        const { data: batch, error } = await supabaseAdmin
            .from('batches')
            .select('*')
            .eq('id', req.params.batchId)
            .eq('tenant_id', req.tenant.id)
            .single();

        if (error || !batch) {
            return res.status(404).json({ error: "Lote não encontrado." });
        }

        // Se o lote teve sucesso, busca resumo das guias emitidas
        let guides = [];
        if (batch.status === 'sucesso') {
            const { data: guidesList } = await supabaseAdmin
                .from('guides')
                .select('*')
                .eq('batch_id', batch.id)
                .eq('tenant_id', req.tenant.id);
            guides = guidesList || [];
        }

        return res.status(200).json({
            batchId: batch.id,
            status: batch.status,
            logs: batch.logs || [],
            error: batch.error_message,
            receipt: batch.receipt,
            guides
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/batch/history
 * Lista os últimos lotes emitidos pelo tenant
 */
router.get('/history', requireAuth, async (req, res) => {
    try {
        const { data: batches, error } = await supabaseAdmin
            .from('batches')
            .select(`
                id,
                created_at,
                status,
                environment,
                receipt,
                error_message,
                guides (id, nf_number, uf, value, barcode, line_digitizable)
            `)
            .eq('tenant_id', req.tenant.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return res.status(200).json({ batches: batches || [] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/guide/download/:guideId
 * Download do arquivo HTML da guia individual
 */
router.get('/guide/download/:guideId', requireAuth, async (req, res) => {
    try {
        const { data: guide, error } = await supabaseAdmin
            .from('guides')
            .select('*')
            .eq('id', req.params.guideId)
            .eq('tenant_id', req.tenant.id)
            .single();

        if (error || !guide || !guide.storage_path) {
            return res.status(404).json({ error: "Guia não encontrada ou sem arquivo associado." });
        }

        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('tenant-storage')
            .download(guide.storage_path);

        if (downloadError || !fileData) {
            return res.status(404).json({ error: "Arquivo da guia não encontrado no armazenamento." });
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="guia_NF_${guide.nf_number}_${guide.uf}.html"`);
        return res.send(buffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/guide/download-all/:batchId
 * Download consolidado de todas as guias do lote em arquivo .ZIP
 */
router.get('/guide/download-all/:batchId', requireAuth, async (req, res) => {
    try {
        const { data: guides, error } = await supabaseAdmin
            .from('guides')
            .select('*')
            .eq('batch_id', req.params.batchId)
            .eq('tenant_id', req.tenant.id);

        if (error || !guides || guides.length === 0) {
            return res.status(404).json({ error: "Nenhuma guia encontrada para este lote." });
        }

        const zip = new AdmZip();

        await Promise.all(guides.map(async (guide) => {
            if (!guide.storage_path) return;
            try {
                const { data, error: downloadError } = await supabaseAdmin.storage
                    .from('tenant-storage')
                    .download(guide.storage_path);

                if (!downloadError && data) {
                    const buffer = Buffer.from(await data.arrayBuffer());
                    const filename = `guia_NF_${guide.nf_number}_${guide.uf}.html`;
                    zip.addFile(filename, buffer);
                }
            } catch (err) {
                console.error(`Erro ao baixar guia ${guide.id} para zip:`, err.message);
            }
        }));

        const zipBuffer = zip.toBuffer();
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="guias_lote_${req.params.batchId}.zip"`);
        return res.send(zipBuffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/remessa/download/:batchId
 * Download do arquivo de remessa CNAB 240 Itaú SISPAG gerado
 */
router.get('/remessa/download/:batchId', requireAuth, async (req, res) => {
    try {
        const storagePath = `${req.tenant.id}/remessas/${req.params.batchId}_remessa.txt`;
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('tenant-storage')
            .download(storagePath);

        if (downloadError || !fileData) {
            return res.status(404).json({ error: "Arquivo de remessa não encontrado para este lote." });
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="remessa_sispag_${req.params.batchId}.txt"`);
        return res.send(buffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
