// server.js
// Servidor Express SaaS Multi-Tenant - API Leve (Vercel Serverless / Local)
// Apex SaaS - Plataforma Fiscal Modular & Faturamento Stripe

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const Stripe = require('stripe');
const { supabaseAdmin } = require('./api/utils/supabase');

const authRoutes = require('./api/routes/auth');
const tenantRoutes = require('./api/routes/tenants');
const batchRoutes = require('./api/routes/batches');
const adminRoutes = require('./api/routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================
// CONFIG - Stripe & Supabase
// =============================================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aliado2026';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const supabase = supabaseAdmin;

// =============================================
// MIDDLEWARE STRIPE WEBHOOK (tem que vir ANTES do express.json)
// =============================================
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !supabase) {
        console.error('Stripe ou Supabase não configurado');
        return res.status(500).send('Config missing');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature error', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Log do evento
    try {
        await supabase.from('stripe_webhook_logs').insert({
            stripe_event_id: event.id,
            tipo: event.type,
            payload: event,
            processado: false
        });
    } catch (e) {
        console.log('log error', e.message);
    }

    // =============================================
    // EVENTOS PRINCIPAIS
    // =============================================
    try {
        switch (event.type) {
            case 'invoice.payment_succeeded':
            case 'invoice.paid': {
                const inv = event.data.object;
                console.log('✅ Pagamento OK', inv.id, inv.amount_paid / 100);

                // Upsert na tabela stripe_invoices
                await supabase.from('stripe_invoices').upsert({
                    stripe_invoice_id: inv.id,
                    stripe_subscription_id: inv.subscription,
                    stripe_customer_id: inv.customer,
                    stripe_payment_intent_id: inv.payment_intent,
                    valor: (inv.amount_due || 0) / 100,
                    valor_pago: (inv.amount_paid || 0) / 100,
                    status: 'paid',
                    pago_em: new Date().toISOString(),
                    vencimento: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
                    link_pagamento: inv.hosted_invoice_url,
                    pdf_url: inv.invoice_pdf,
                    tipo: inv.billing_reason === 'subscription_create' ? 'assinatura' : 'assinatura'
                }, { onConflict: 'stripe_invoice_id' });

                // Libera tenant: ativo + atualiza uso
                if (inv.customer) {
                    const { data: tenant } = await supabase.from('tenants').select('id').eq('stripe_customer_id', inv.customer).single();
                    if (tenant) {
                        await supabase.from('tenants').update({ subscription_status: 'ativo' }).eq('id', tenant.id);
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                const inv = event.data.object;
                console.log('❌ Pagamento FALHOU', inv.id, inv.last_finalization_error?.message);

                await supabase.from('stripe_invoices').upsert({
                    stripe_invoice_id: inv.id,
                    stripe_subscription_id: inv.subscription,
                    stripe_customer_id: inv.customer,
                    valor: (inv.amount_due || 0) / 100,
                    status: 'failed',
                    tentativas_cobranca: inv.attempt_count || 0,
                    proxima_tentativa_em: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000).toISOString() : null,
                    motivo_falha: inv.last_finalization_error?.message || 'card_declined',
                    vencimento: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : new Date().toISOString(),
                    link_pagamento: inv.hosted_invoice_url,
                    pdf_url: inv.invoice_pdf,
                    tipo: 'assinatura'
                }, { onConflict: 'stripe_invoice_id' });

                // Marca tenant como inadimplente
                if (inv.customer) {
                    const { data: tenant } = await supabase.from('tenants').select('id').eq('stripe_customer_id', inv.customer).single();
                    if (tenant) {
                        await supabase.from('tenants').update({ subscription_status: 'inadimplente' }).eq('id', tenant.id);
                    }
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                console.log('🔄 Subscription', sub.id, sub.status);

                // Busca tenant pelo customer
                let tenantId = null;
                if (sub.customer && supabase) {
                    const { data } = await supabase.from('tenants').select('id').eq('stripe_customer_id', sub.customer).single();
                    tenantId = data?.id;
                }

                if (tenantId) {
                    await supabase.from('subscriptions').upsert({
                        stripe_subscription_id: sub.id,
                        stripe_customer_id: sub.customer,
                        stripe_price_id: sub.items.data[0]?.price?.id,
                        tenant_id: tenantId,
                        plano: sub.items.data[0]?.price?.nickname || 'pro',
                        valor: (sub.items.data[0]?.price?.unit_amount || 0) / 100,
                        status: sub.status,
                        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: sub.cancel_at_period_end
                    }, { onConflict: 'stripe_subscription_id' });
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                if (supabase) {
                    await supabase.from('tenants').update({ subscription_status: 'cancelado' }).eq('stripe_customer_id', sub.customer);
                }
                break;
            }
        }

        // Marca webhook como processado
        await supabase.from('stripe_webhook_logs').update({ processado: true }).eq('stripe_event_id', event.id);

    } catch (err) {
        console.error('Erro processando webhook', err);
        await supabase.from('stripe_webhook_logs').update({ erro: err.message }).eq('stripe_event_id', event.id);
        return res.status(500).send('Error');
    }

    return res.json({ received: true });
});

// =============================================
// MIDDLEWARES NORMAIS (depois do webhook)
// =============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Log de requisições simplificado
app.use((req, res, next) => {
    if (!req.url.startsWith('/css') && !req.url.startsWith('/js')) {
        console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
});

// Previne cache agressivo de HTML no navegador do usuário
app.use((req, res, next) => {
    if (req.url.endsWith('.html') || req.url === '/' || req.url === '/app') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// PROTEÇÃO ADMIN - Grupo Aliado Hub Tech
// =============================================
function adminAuth(req, res, next) {
    const key = req.query.key || req.headers['x-admin-key'] || req.cookies?.admin_key;
    if (!ADMIN_PASSWORD) return next();
    if (key === ADMIN_PASSWORD) return next();

    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Admin auth required' });

    return res.send(`
    <html><body style="background:#08080f;color:white;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="background:#0f0f19;border:1px solid rgba(255,255,255,0.06);padding:32px;border-radius:16px;text-align:center;max-width:360px;width:90%">
        <h2 style="margin:0 0 8px 0;font-size:22px">🔒 Apex Admin</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 20px 0;line-height:1.5">Grupo Aliado Hub Tech LTDA<br/>Área restrita do dono do SaaS</p>
        <form method="GET" style="margin-top:20px">
          <input name="key" type="password" placeholder="Senha admin" style="width:100%;box-sizing:border-box;padding:12px 16px;border-radius:9999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:white;outline:none"/>
          <button style="margin-top:12px;width:100%;padding:12px;border-radius:9999px;background:#6366f1;color:white;border:0;font-weight:600;cursor:pointer">Entrar</button>
        </form>
        <p style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:16px">Defina ADMIN_PASSWORD na Vercel</p>
      </div>
    </body></html>
  `);
}

// =============================================
// ROTAS DA API & ADMIN
// =============================================

// API - dados financeiros para o /admin (protegida)
app.get('/api/admin/financeiro', adminAuth, async (req, res) => {
    if (!supabase) return res.json({ error: 'Supabase não configurado' });

    const { data: invoices } = await supabase.from('stripe_invoices').select('*').order('created_at', { ascending: false }).limit(100);
    const { data: inadimplentes } = await supabase.from('view_inadimplentes').select('*');
    const { data: tenants } = await supabase.from('tenants').select('*');
    const { data: webhooks } = await supabase.from('stripe_webhook_logs').select('*').order('created_at', { ascending: false }).limit(20);

    // KPIs
    const mrr = tenants?.reduce((acc, t) => acc + (t.subscription_status === 'ativo' ? Number(t.plano_valor || (t.plan === 'starter' ? 199 : t.plan === 'pro' ? 399 : t.plan === 'advanced' ? 699 : 0)) : 0), 0) || 0;
    const totalInadimplencia = inadimplentes?.reduce((acc, i) => acc + Number(i.valor || 0), 0) || 0;

    return res.json({
        kpis: { mrr, totalInadimplencia, totalClientes: tenants?.length || 0, inadimplentes: inadimplentes?.length || 0 },
        invoices: invoices || [],
        inadimplentes: inadimplentes || [],
        tenants: tenants || [],
        webhooks: webhooks || []
    });
});

// Admin financeiro
app.get('/admin', adminAuth, (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==========================================
// REGISTRO DE ROTAS DA API MODULAR
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/admin', adminRoutes);

// Endpoint do pipeline /api/apex/emitir
app.use('/api/apex/emitir', (req, res, next) => {
    req.url = '/process';
    batchRoutes(req, res, next);
});

// Rotas de download diretas montadas no roteador de lotes
app.use('/api/guide', batchRoutes);
app.use('/api/remessa', batchRoutes);

// Redireciona o painel antigo para o novo pipeline de 1 tela
app.get(['/dashboard', '/dashboard.html'], (req, res) => {
    return res.redirect('/app');
});

// App do cliente (plataforma fiscal)
app.get('/app', (req, res) => {
    const appPath = path.join(__dirname, 'public', 'app.html');
    if (fs.existsSync(appPath)) return res.sendFile(appPath);
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Landing de venda
app.get('/', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de login
app.get(['/login', '/login.html'], (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota de compatibilidade para download de remessa legado
app.get('/download/remessa.txt', async (req, res) => {
    try {
        const localPath = process.env.NODE_ENV === 'production' || process.env.VERCEL
            ? path.join('/tmp', 'remessa.txt')
            : path.join(__dirname, 'remessa.txt');
        await fsPromises.access(localPath);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="remessa.txt"');
        return res.sendFile(localPath);
    } catch (e) {
        return res.status(404).send("Arquivo remessa.txt não localizado. Processe um lote primeiro.");
    }
});

// Fallback SPA para navegação do frontend
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/download')) {
        return next();
    }
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Inicialização do servidor para ambiente local
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`🚀 Apex SaaS rodando na porta ${PORT} - Webhook: /api/webhooks/stripe`);
        console.log(`🔗 Interface Web: http://localhost:${PORT}`);
        console.log(`==================================================\n`);
    });
}

module.exports = app;
