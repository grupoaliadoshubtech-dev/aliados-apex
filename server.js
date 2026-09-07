// server.js
// Servidor Express SaaS Multi-Tenant - API Leve (Vercel Serverless / Local)
// Apex SaaS - Plataforma Fiscal Modular & Faturamento Stripe

const fs = require('fs');
const path = require('path');
require('dotenv').config();
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });
}
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const fsPromises = fs.promises;
const Stripe = require('stripe');
const { supabaseAdmin } = require('./api/utils/supabase');
const { sendPaymentSuccessEmail, sendPaymentFailedEmail } = require('./services/email_service');
const { sentryRequestHandler, sentryErrorHandler } = require('./api/utils/sentry');

const authRoutes = require('./api/routes/auth');
const tenantRoutes = require('./api/routes/tenants');
const batchRoutes = require('./api/routes/batches');
const adminRoutes = require('./api/routes/admin');
const stripeRoutes = require('./api/routes/stripe');

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================
// CONFIG - Stripe & Supabase
// =============================================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const rawAdminPass = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD = rawAdminPass ? String(rawAdminPass).trim().replace(/^["']+|["']+$/g, '') : null;

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
                    const { data: tenant } = await supabase.from('tenants')
                        .select('id, razao_social')
                        .eq('stripe_customer_id', inv.customer).single();
                    if (tenant) {
                        await supabase.from('tenants').update({ subscription_status: 'ativo' }).eq('id', tenant.id);
                    }

                    // Busca e-mail do admin do tenant para notificação
                    const { data: profile } = await supabase.from('profiles')
                        .select('email, name')
                        .eq('tenant_id', tenant?.id)
                        .eq('is_admin', false)
                        .limit(1).single();

                    if (profile?.email) {
                        setImmediate(() => {
                            sendPaymentSuccessEmail({
                                to: profile.email,
                                name: profile.name || tenant?.razao_social,
                                valor: (inv.amount_paid || 0) / 100,
                                plano: inv.lines?.data?.[0]?.description || 'Assinatura Apex',
                                periodoFim: inv.lines?.data?.[0]?.period?.end
                                    ? new Date(inv.lines.data[0].period.end * 1000).toISOString()
                                    : null,
                                invoiceUrl: inv.hosted_invoice_url
                            }).catch(e => console.error('[Email] Falha payment_success:', e.message));
                        });
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
                    const { data: tenant } = await supabase.from('tenants')
                        .select('id, razao_social')
                        .eq('stripe_customer_id', inv.customer).single();
                    if (tenant) {
                        await supabase.from('tenants').update({ subscription_status: 'inadimplente' }).eq('id', tenant.id);
                    }

                    // Notifica via e-mail
                    const { data: profile } = await supabase.from('profiles')
                        .select('email, name')
                        .eq('tenant_id', tenant?.id)
                        .limit(1).single();

                    if (profile?.email) {
                        setImmediate(() => {
                            sendPaymentFailedEmail({
                                to: profile.email,
                                name: profile.name || tenant?.razao_social,
                                valor: (inv.amount_due || 0) / 100,
                                motivoFalha: inv.last_finalization_error?.message || 'Cartão recusado',
                                linkPagamento: inv.hosted_invoice_url
                            }).catch(e => console.error('[Email] Falha payment_failed:', e.message));
                        });
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

// =============================================
// SEGURANÇA — Helmet (HTTP Security Headers)
// =============================================
// Sentry deve ser o PRIMEIRO middleware (antes de tudo)
app.use(sentryRequestHandler());

app.use(helmet({

    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com', 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            frameSrc: ['https://js.stripe.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.stripe.com']
        }
    },
    crossOriginEmbedderPolicy: false  // necessário para iframes do Stripe
}));

// =============================================
// RATE LIMITING — Por rota sensível
// =============================================

// Login: máx 10 tentativas por IP em 15 minutos (anti brute-force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

// Upload de lote: máx 5 envios por minuto por IP
const batchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Limite de envio de lotes atingido. Aguarde 1 minuto.' }
});

// API geral: máx 100 req/min por IP
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em instantes.' }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', loginLimiter);
app.use('/api/batch/process', batchLimiter);
app.use('/api/apex/emitir', batchLimiter);
app.use('/api/', apiLimiter);

// Health Check para UptimeRobot, Vercel, Railway e monitoramento de infraestrutura
app.get(['/health', '/api/health'], async (req, res) => {
    // Se o usuário acessar /health diretamente no navegador, exibe o painel visual de status
    if (req.path === '/health' && req.accepts('html') && !req.xhr && !req.query.format) {
        return res.sendFile(path.join(__dirname, 'public', 'health.html'));
    }

    const startTime = Date.now();
    let dbStatus = 'connected';
    let dbLatencyMs = 0;

    try {
        const dbStart = Date.now();
        const { error } = await supabaseAdmin.from('tenants').select('id').limit(1);
        dbLatencyMs = Date.now() - dbStart;
        if (error) {
            dbStatus = 'error: ' + error.message;
        }
    } catch (e) {
        dbStatus = 'unreachable: ' + e.message;
    }

    const isHealthy = dbStatus === 'connected';
    const statusCode = isHealthy ? 200 : 503;

    return res.status(statusCode).json({
        status: isHealthy ? 'healthy' : 'degraded',
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
            status: dbStatus,
            latency_ms: dbLatencyMs
        },
        environment: process.env.NODE_ENV || 'development',
        version: '2.1.0',
        response_time_ms: Date.now() - startTime
    });
});

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
    const rawKey = req.query.key || req.headers['x-admin-key'] || req.cookies?.admin_key;
    const cleanKey = rawKey ? String(rawKey).trim().replace(/^["']+|["']+$/g, '') : '';

    if (!ADMIN_PASSWORD) return next();
    if (cleanKey && cleanKey === ADMIN_PASSWORD) {
        return next();
    }

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
app.use('/api/stripe', stripeRoutes);

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

// Páginas legais (LGPD)
app.get(['/privacidade', '/privacidade.html'], (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'privacidade.html'));
});
app.get(['/termos', '/termos.html', '/termos-de-uso'], (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'termos.html'));
});

// Central de Documentação, Manuais e Ajuda
app.get(['/docs', '/docs.html', '/ajuda', '/ajuda.html', '/manual'], (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// Rota de compatibilidade para download de remessa legado
// CORRIGIDO: Usa Supabase Storage (persistente) em vez de /tmp (efêmero na Vercel)
app.get('/download/remessa.txt', async (req, res) => {
    const { requireAuth } = require('./api/middlewares/auth');
    return requireAuth(req, res, async () => {
        try {
            if (!req.tenant) return res.status(401).send('Tenant não identificado.');

            // Busca o lote mais recente com sucesso deste tenant
            const { data: batch } = await supabaseAdmin
                .from('batches')
                .select('id')
                .eq('tenant_id', req.tenant.id)
                .eq('status', 'sucesso')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!batch) return res.status(404).send('Nenhuma remessa disponível. Processe um lote primeiro.');

            const storagePath = `${req.tenant.id}/remessas/${batch.id}_remessa.txt`;
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from('tenant-storage')
                .download(storagePath);

            if (downloadError || !fileData) {
                return res.status(404).send('Arquivo remessa.txt não localizado. Processe um lote primeiro.');
            }

            const buffer = Buffer.from(await fileData.arrayBuffer());
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="remessa.txt"');
            return res.send(buffer);
        } catch (e) {
            return res.status(500).send('Erro ao buscar remessa: ' + e.message);
        }
    });
});

// Fallback SPA para navegação do frontend (Express 5: usar /{*path} em vez de *)
app.get('/{*path}', (req, res, next) => {
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

// Sentry DEVE ser o último middleware (captura erros de todas as rotas)
app.use(sentryErrorHandler());

module.exports = app;
