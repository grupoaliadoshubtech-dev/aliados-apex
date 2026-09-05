// api/routes/admin.js
// Rotas administrativas protegidas por requireAdmin

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

// Todas as rotas deste router exigem autenticação e privilégio de administrador
router.use(requireAuth, requireAdmin);

router.get('/tenants', async (req, res) => {
    try {
        const { data: tenants, error } = await supabaseAdmin
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ tenants });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/tenants/status', async (req, res) => {
    const { tenantId, status } = req.body;
    if (!tenantId || !status) {
        return res.status(400).json({ error: "Tenant ID e status são obrigatórios." });
    }

    try {
        const { error } = await supabaseAdmin
            .from('tenants')
            .update({ subscription_status: status })
            .eq('id', tenantId);

        if (error) throw error;
        return res.status(200).json({ message: "Status da empresa atualizado com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabaseAdmin
            .from('profiles')
            .select('*, tenants(cnpj, razao_social, subscription_status)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ users });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/users/create', async (req, res) => {
    const { email, password, name, tenantId, isAdmin } = req.body;
    if (!email || !password || !tenantId) {
        return res.status(400).json({ error: "E-mail, senha e Empresa (Tenant) são obrigatórios." });
    }

    try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || "Erro ao criar usuário no Supabase Auth." });
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authData.user.id,
                tenant_id: tenantId,
                email,
                name: name || email.split('@')[0],
                is_admin: !!isAdmin
            });

        if (profileError) {
            return res.status(400).json({ error: "Erro ao criar perfil: " + profileError.message });
        }

        return res.status(200).json({ message: "Usuário criado com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/users/reset-password', async (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
        return res.status(400).json({ error: "ID do usuário e nova senha são obrigatórios." });
    }

    try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (error) throw error;
        return res.status(200).json({ message: "Senha redefinida com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
