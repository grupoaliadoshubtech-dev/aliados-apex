// api/routes/auth.js
// Rotas de autenticação e sessão de usuários

const express = require('express');
const router = express.Router();
const { supabaseAdmin, createScopedClient } = require('../utils/supabase');
const { requireAuth } = require('../middlewares/auth');

router.post('/register', async (req, res) => {
    const { email, password, name, cnpj, razao_social, plan } = req.body;
    if (!email || !password || !cnpj || !razao_social) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    const validPlans = ['trial', 'starter', 'pro', 'advanced'];
    const finalPlan = validPlans.includes(plan) ? plan : 'trial';

    const PLAN_LIMITS = {
        'trial': 10,
        'starter': 100,
        'pro': 500,
        'advanced': 1500
    };

    try {
        // 1. Cria credenciais no Supabase Auth via API Admin
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || "Erro ao criar credenciais de acesso." });
        }

        const user = authData.user;

        // 2. Insere a empresa na tabela de tenants
        const { data: tenantData, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({
                cnpj: cnpj.replace(/[^0-9]/g, ''),
                razao_social: razao_social,
                bank_agency: '0000',
                bank_account: '00000',
                bank_dac: '0',
                environment: 'simulado',
                plan: finalPlan,
                monthly_quota: PLAN_LIMITS[finalPlan] || 10,
                used_this_month: 0,
                subscription_status: 'ativo'
            })
            .select()
            .single();

        if (tenantError) {
            return res.status(400).json({ error: "Erro ao criar tenant da empresa: " + tenantError.message });
        }

        // 3. Cria o perfil do usuário vinculado ao tenant
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: user.id,
                tenant_id: tenantData.id,
                email: email,
                name: name || razao_social,
                is_admin: false
            });

        if (profileError) {
            return res.status(400).json({ error: "Erro ao criar perfil de usuário: " + profileError.message });
        }

        return res.status(200).json({ message: "Cadastro realizado com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    try {
        // Cria cliente isolado para evitar poluição de sessão no singleton
        const tempClient = createScopedClient(null);
        const { data, error } = await tempClient.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            return res.status(401).json({ error: error?.message || "E-mail ou senha incorretos." });
        }

        const token = data.session.access_token;

        // Define cookie seguro válido por 7 dias
        res.cookie('sb_access_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        return res.status(200).json({ message: "Login efetuado com sucesso!", token });
    } catch (err) {
        console.error("[Login Exception]:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('sb_access_token');
    return res.status(200).json({ message: "Logout efetuado com sucesso." });
});

router.get('/me', requireAuth, (req, res) => {
    return res.status(200).json({
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.profile.name
        },
        profile: {
            is_admin: req.profile.is_admin,
            name: req.profile.name,
            email: req.profile.email
        },
        tenant: req.tenant
    });
});

module.exports = router;
