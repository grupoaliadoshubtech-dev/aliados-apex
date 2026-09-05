// api/routes/tenants.js
// Rotas de configuração da empresa (tenant), certificado digital PFX e planos

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../utils/supabase');
const { getEncryptionKey, encrypt } = require('../utils/encryption');
const { requireAuth } = require('../middlewares/auth');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max para PFX
});

router.post('/settings', requireAuth, async (req, res) => {
    const { cnpj, razao_social, bank_agency, bank_account, bank_dac, environment } = req.body;
    if (!cnpj || !razao_social || !bank_agency || !bank_account || !bank_dac) {
        return res.status(400).json({ error: "Todos os dados cadastrais e bancários são obrigatórios." });
    }

    try {
        const { error } = await supabaseAdmin
            .from('tenants')
            .update({
                cnpj: cnpj.replace(/[^0-9]/g, ''),
                razao_social: razao_social,
                bank_agency: bank_agency.replace(/[^0-9]/g, ''),
                bank_account: bank_account.replace(/[^0-9]/g, ''),
                bank_dac: bank_dac.replace(/[^0-9]/g, ''),
                environment: environment || 'simulado'
            })
            .eq('id', req.tenant.id);

        if (error) throw error;

        return res.status(200).json({ message: "Configurações atualizadas com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/upload-pfx', requireAuth, upload.single('pfx'), async (req, res) => {
    const { passphrase } = req.body;
    if (!req.file || !passphrase) {
        return res.status(400).json({ error: "Arquivo do certificado .pfx e senha são obrigatórios." });
    }

    try {
        // Sanitiza o nome do arquivo para evitar caracteres especiais no Supabase Storage
        const rawFilename = req.file.originalname;
        const filename = rawFilename
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.\-_]/g, '_');

        // 1. Upload do certificado PFX para a pasta privada do tenant no storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('tenant-storage')
            .upload(`${req.tenant.id}/certificados/${filename}`, req.file.buffer, {
                contentType: 'application/x-pkcs12',
                upsert: true
            });

        if (uploadError) {
            return res.status(400).json({ error: "Falha ao salvar arquivo no storage: " + uploadError.message });
        }

        // 2. Criptografa a senha com AES-256-CBC (REGRA: NUNCA logar a senha)
        const key = getEncryptionKey(process.env.ENCRYPTION_KEY);
        const encryptedPassphrase = encrypt(passphrase, key);

        // 3. Atualiza tenant no banco
        const { error: dbError } = await supabaseAdmin
            .from('tenants')
            .update({
                pfx_filename: filename,
                pfx_passphrase_encrypted: encryptedPassphrase
            })
            .eq('id', req.tenant.id);

        if (dbError) throw dbError;

        return res.status(200).json({ message: "Certificado PFX cadastrado e protegido com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/plan', requireAuth, async (req, res) => {
    const { plan } = req.body;
    const PLAN_LIMITS = {
        'trial': 10,
        'starter': 100,
        'pro': 500,
        'advanced': 1500,
        'ativo': 500
    };

    if (!plan || !PLAN_LIMITS.hasOwnProperty(plan)) {
        return res.status(400).json({ error: "Plano selecionado inválido." });
    }

    try {
        const { error } = await supabaseAdmin
            .from('tenants')
            .update({
                plan,
                monthly_quota: PLAN_LIMITS[plan],
                subscription_status: plan === 'inativo' ? 'inativo' : 'ativo'
            })
            .eq('id', req.tenant.id);

        if (error) throw error;

        return res.status(200).json({ message: "Plano de assinatura atualizado com sucesso!", plan });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
