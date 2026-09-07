// api/routes/auth.js
// Rotas de autenticação e sessão de usuários

const express = require('express');
const router = express.Router();
const { supabaseAdmin, createScopedClient } = require('../utils/supabase');
const { requireAuth } = require('../middlewares/auth');
const { validateBody } = require('../middlewares/validate');
const { registerSchema, loginSchema } = require('../schemas');
const { sendWelcomeEmail, sendTrialExpiringEmail } = require('../../services/email_service');

// Versão atual dos documentos legais
const TERMS_VERSION = 'v1.0';
const PRIVACY_VERSION = 'v1.0';

router.post('/register', validateBody(registerSchema), async (req, res) => {
    const { email, password, name, cnpj, razao_social, plan, aceite_termos, aceite_privacidade } = req.body;

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

        // 4. Registra o consentimento explícito do usuário (LGPD)
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
        const userAgent = req.headers['user-agent'];
        await supabaseAdmin.from('consent_log').insert([
            {
                user_id: user.id,
                tenant_id: tenantData.id,
                tipo: 'termos_de_uso',
                versao: TERMS_VERSION,
                ip_address: clientIp,
                user_agent: userAgent
            },
            {
                user_id: user.id,
                tenant_id: tenantData.id,
                tipo: 'politica_privacidade',
                versao: PRIVACY_VERSION,
                ip_address: clientIp,
                user_agent: userAgent
            }
        ]);

        // 5. E-mail de boas-vindas (não-bloqueante — nunca atrasa a resposta ao usuário)
        setImmediate(() => {
            sendWelcomeEmail({
                to: email,
                name: name || razao_social,
                razaoSocial: razao_social,
                plan: finalPlan
            }).catch(e => console.error('[Email] Falha no welcome email:', e.message));
        });

        return res.status(200).json({ message: "Cadastro realizado com sucesso!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body;

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
        const refreshToken = data.session.refresh_token;
        const expiresAt = data.session.expires_at;

        // Define cookie seguro válido por 7 dias
        res.cookie('sb_access_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        return res.status(200).json({ 
            message: "Login efetuado com sucesso!", 
            token, 
            refreshToken, 
            expiresAt 
        });
    } catch (err) {
        console.error("[Login Exception]:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/auth/refresh
 * Renova a sessão usando o refresh_token do Supabase
 */
router.post('/refresh', async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token obrigatório." });
    }

    try {
        const tempClient = createScopedClient(null);
        const { data, error } = await tempClient.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error || !data.session) {
            return res.status(401).json({ error: error?.message || "Sessão expirada. Faça login novamente." });
        }

        const token = data.session.access_token;
        const newRefreshToken = data.session.refresh_token;
        const expiresAt = data.session.expires_at;

        res.cookie('sb_access_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        return res.status(200).json({
            message: "Sessão renovada com sucesso!",
            token,
            refreshToken: newRefreshToken,
            expiresAt
        });
    } catch (err) {
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
