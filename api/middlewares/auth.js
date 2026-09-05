// api/middlewares/auth.js
// Middlewares de autenticação, autorização e assinatura multi-tenant

const { supabaseAdmin } = require('../utils/supabase');

const requireAuth = async (req, res, next) => {
    const token = req.cookies?.sb_access_token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Não autorizado. Por favor, faça login." });
    }

    try {
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: "Sessão inválida ou expirada." });
        }

        // Busca o perfil do usuário e dados do tenant correspondente
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*, tenants(*)')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || !profile.tenants) {
            return res.status(401).json({ error: "Perfil de usuário ou empresa não configurados." });
        }

        let tenant = profile.tenants;
        if (Array.isArray(tenant)) {
            tenant = tenant[0];
        }

        req.user = user;
        req.profile = profile;
        req.tenant = tenant;
        req.token = token;
        next();
    } catch (err) {
        console.error("[Auth Middleware] Erro:", err.message);
        return res.status(401).json({ error: "Erro de autenticação: " + err.message });
    }
};

const requireActiveSubscription = (req, res, next) => {
    if (req.tenant && (req.tenant.subscription_status === 'inativo' || req.tenant.subscription_status === 'cancelado')) {
        return res.status(403).json({ error: "Assinatura pendente ou suspensa. Regularize o pagamento para emitir novas guias." });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.profile || !req.profile.is_admin) {
        return res.status(403).json({ error: "Acesso restrito para administradores." });
    }
    next();
};

module.exports = {
    requireAuth,
    requireActiveSubscription,
    requireAdmin
};
