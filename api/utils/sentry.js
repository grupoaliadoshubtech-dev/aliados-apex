// api/utils/sentry.js
// Inicialização e utilitários do Sentry para rastreamento de erros em produção

const Sentry = require('@sentry/node');

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.npm_package_version || '2.0.0',

        // Captura 100% das transações em dev, 10% em produção
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Não loga dados sensíveis
        beforeSend(event) {
            // Remove dados de autenticação dos breadcrumbs
            if (event.request?.cookies) {
                delete event.request.cookies.sb_access_token;
            }
            if (event.request?.headers?.authorization) {
                event.request.headers.authorization = '[REDACTED]';
            }
            return event;
        }
    });
    console.log('[Sentry] ✅ Monitoramento de erros ativo');
} else {
    console.warn('[Sentry] ⚠️ SENTRY_DSN não configurado — erros não serão rastreados');
}

/**
 * Captura uma exceção com contexto adicional de tenant
 */
function captureException(err, context = {}) {
    if (!SENTRY_DSN) {
        console.error('[Error]', err.message, context);
        return;
    }
    Sentry.withScope(scope => {
        if (context.tenantId) scope.setTag('tenant_id', context.tenantId);
        if (context.userId)   scope.setTag('user_id', context.userId);
        if (context.route)    scope.setTag('route', context.route);
        if (context.extra)    scope.setExtras(context.extra);
        Sentry.captureException(err);
    });
}

/**
 * Middleware Express para capturar erros não tratados (Sentry v8)
 * No Sentry v8, use Sentry.setupExpressErrorHandler(app) após registrar as rotas
 */
function sentryErrorHandler() {
    // Retorna middleware padrão de erro que captura via Sentry
    return (err, req, res, next) => {
        if (SENTRY_DSN) {
            Sentry.captureException(err);
        }
        next(err);
    };
}

/**
 * Middleware Express de rastreamento de requests (Sentry v8)
 * No v8, o rastreamento é automático — este é um no-op que mantém compatibilidade
 */
function sentryRequestHandler() {
    return (req, res, next) => next();
}

module.exports = { captureException, sentryErrorHandler, sentryRequestHandler, Sentry };
