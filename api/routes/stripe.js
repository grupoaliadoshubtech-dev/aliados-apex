// api/routes/stripe.js
// Rotas de faturamento Stripe: Checkout, Portal do Cliente e Status de Assinatura

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { supabaseAdmin } = require('../utils/supabase');
const { requireAuth } = require('../middlewares/auth');
const { validateBody } = require('../middlewares/validate');
const { checkoutSessionSchema } = require('../schemas');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Mapa de planos para Price IDs (configurados no .env)
const PRICE_IDS = {
    starter:  process.env.STRIPE_PRICE_STARTER,
    pro:      process.env.STRIPE_PRICE_PRO,
    advanced: process.env.STRIPE_PRICE_ADVANCED
};

// Mapa de limites de guias por plano
const PLAN_LIMITS = {
    starter: 100,
    pro: 500,
    advanced: 1500
};

/**
 * POST /api/stripe/create-checkout-session
 * Cria uma sessão de checkout Stripe para o plano escolhido.
 * Retorna a URL para redirecionar o usuário.
 */
router.post('/create-checkout-session', requireAuth, validateBody(checkoutSessionSchema), async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Gateway de pagamento não configurado.' });

    const { plan } = req.body;
    if (!PRICE_IDS[plan]) {
        return res.status(400).json({ error: `Price ID para o plano ${plan} não configurado no servidor.` });
    }

    const tenant = req.tenant;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    try {
        // Garante que o cliente já existe no Stripe ou cria um novo
        let stripeCustomerId = tenant.stripe_customer_id;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: tenant.razao_social,
                metadata: {
                    tenant_id: tenant.id,
                    cnpj: tenant.cnpj
                }
            });
            stripeCustomerId = customer.id;

            // Salva o customer_id no tenant
            await supabaseAdmin
                .from('tenants')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('id', tenant.id);
        }

        // Cria a sessão de checkout
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: PRICE_IDS[plan],
                quantity: 1
            }],
            subscription_data: {
                metadata: {
                    tenant_id: tenant.id,
                    plano: plan
                }
            },
            success_url: `${appUrl}/app?checkout=success&plan=${plan}`,
            cancel_url:  `${appUrl}/plans?checkout=cancelled`,
            locale: 'pt-BR',
            allow_promotion_codes: true,
            metadata: {
                tenant_id: tenant.id,
                plano: plan
            }
        });

        return res.status(200).json({ url: session.url, sessionId: session.id });

    } catch (err) {
        console.error('[Stripe Checkout] Erro:', err.message);
        return res.status(500).json({ error: 'Erro ao criar sessão de pagamento: ' + err.message });
    }
});

/**
 * POST /api/stripe/create-portal-session
 * Redireciona o cliente para o portal Stripe para gerenciar/cancelar assinatura.
 */
router.post('/create-portal-session', requireAuth, async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Gateway de pagamento não configurado.' });

    const tenant = req.tenant;
    if (!tenant.stripe_customer_id) {
        return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada.' });
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    try {
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: tenant.stripe_customer_id,
            return_url: `${appUrl}/app?portal=returned`
        });

        return res.status(200).json({ url: portalSession.url });

    } catch (err) {
        console.error('[Stripe Portal] Erro:', err.message);
        return res.status(500).json({ error: 'Erro ao abrir portal de assinatura: ' + err.message });
    }
});

/**
 * GET /api/stripe/subscription
 * Retorna o status atual da assinatura do tenant autenticado.
 */
router.get('/subscription', requireAuth, async (req, res) => {
    const tenant = req.tenant;

    try {
        // Busca assinatura ativa no banco local
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Busca últimas faturas
        const { data: invoices } = await supabaseAdmin
            .from('stripe_invoices')
            .select('stripe_invoice_id, valor, status, pago_em, vencimento, link_pagamento, pdf_url')
            .eq('stripe_customer_id', tenant.stripe_customer_id || '')
            .order('created_at', { ascending: false })
            .limit(6);

        return res.status(200).json({
            tenant: {
                plan: tenant.plan,
                subscription_status: tenant.subscription_status,
                monthly_quota: tenant.monthly_quota,
                used_this_month: tenant.used_this_month,
                stripe_customer_id: tenant.stripe_customer_id
            },
            subscription: sub || null,
            invoices: invoices || []
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/stripe/trial-to-paid
 * Rota interna para verificar e encerrar trials expirados (chamada por cron ou webhook)
 */
router.post('/expire-trials', async (req, res) => {
    // Protegida por chave de admin — não requer JWT de usuário
    const key = req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    try {
        // Tenants em trial com mais de 30 dias de existência → bloquear
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);

        const { data: expired, error } = await supabaseAdmin
            .from('tenants')
            .update({ subscription_status: 'trial_expirado' })
            .eq('plan', 'trial')
            .eq('subscription_status', 'ativo')
            .lt('created_at', cutoff.toISOString())
            .select('id, razao_social');

        if (error) throw error;

        return res.status(200).json({
            message: `${expired?.length || 0} trial(s) expirado(s).`,
            expired: expired || []
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
