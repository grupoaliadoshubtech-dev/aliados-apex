// services/email_service.js
// Serviço de E-mail Transacional via Resend
// Cobre: boas-vindas, pagamento, falha, cota, vencimento de certificado

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'Apex GNRE <noreply@grupoaliado.com.br>';
const REPLY_TO  = process.env.EMAIL_REPLY_TO || 'contato@grupoaliado.com.br';

// ─────────────────────────────────────────────────────────────
// Utilitário interno
// ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
    if (!resend) {
        console.warn('[Email] RESEND_API_KEY não configurada — e-mail não enviado:', subject);
        return { skipped: true };
    }
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            reply_to: REPLY_TO,
            to: Array.isArray(to) ? to : [to],
            subject,
            html
        });
        if (error) throw new Error(error.message);
        console.log(`[Email] ✅ Enviado: "${subject}" → ${to}`);
        return data;
    } catch (err) {
        console.error(`[Email] ❌ Falha ao enviar "${subject}":`, err.message);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────
// Template base com identidade visual Apex
// ─────────────────────────────────────────────────────────────
function baseTemplate(content) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Apex GNRE</title>
</head>
<body style="margin:0;padding:0;background:#08080f;font-family:Inter,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08080f;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
              Apex<span style="color:#6366f1;">.</span>
            </span>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase;">
              Grupo Aliado Hub Tech
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
              © 2026 Grupo Aliado Hub Tech LTDA · Apex GNRE SaaS<br/>
              <a href="${process.env.APP_URL || 'https://apex.grupoaliado.com.br'}/privacidade" style="color:rgba(99,102,241,0.6);text-decoration:none;">Política de Privacidade</a>
              &nbsp;·&nbsp;
              <a href="${process.env.APP_URL || 'https://apex.grupoaliado.com.br'}/termos" style="color:rgba(99,102,241,0.6);text-decoration:none;">Termos de Uso</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function h1(text) {
    return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">${text}</h1>`;
}
function p(text) {
    return `<p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.7;">${text}</p>`;
}
function btn(text, url) {
    return `<div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:600;letter-spacing:0.2px;">${text}</a>
    </div>`;
}
function info(label, value) {
    return `<tr>
      <td style="padding:10px 16px;font-size:13px;color:rgba(255,255,255,0.45);border-bottom:1px solid rgba(255,255,255,0.05);">${label}</td>
      <td style="padding:10px 16px;font-size:13px;color:rgba(255,255,255,0.85);font-weight:500;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${value}</td>
    </tr>`;
}
function infoTable(rows) {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin:20px 0;">
      ${rows.map(([l, v]) => info(l, v)).join('')}
    </table>`;
}
function alert(text, color = '#f59e0b') {
    return `<div style="background:${color}18;border:1px solid ${color}33;border-radius:10px;padding:14px 18px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:${color};line-height:1.6;">${text}</p>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// E-MAILS DISPONÍVEIS
// ─────────────────────────────────────────────────────────────

/**
 * E-mail de boas-vindas após cadastro
 */
async function sendWelcomeEmail({ to, name, razaoSocial, plan }) {
    const PLAN_NAMES = { trial: 'Trial Gratuito', starter: 'Starter', pro: 'Pro', advanced: 'Advanced' };
    const appUrl = process.env.APP_URL || 'https://apex.grupoaliado.com.br';

    const html = baseTemplate(`
        ${h1(`Bem-vindo ao Apex, ${name || razaoSocial}! 🎉`)}
        ${p('Seu cadastro foi realizado com sucesso. A plataforma de automação fiscal mais avançada do Brasil está pronta para sua empresa.')}
        ${infoTable([
            ['Empresa', razaoSocial],
            ['Plano', PLAN_NAMES[plan] || plan],
            ['Status', plan === 'trial' ? '✅ Trial ativo (30 dias)' : '✅ Ativo']
        ])}
        ${p('Para começar a emitir guias GNRE, complete o cadastro da sua empresa:')}
        <ol style="color:rgba(255,255,255,0.65);font-size:14px;line-height:2;padding-left:20px;margin:0 0 20px;">
          <li>Configure os dados bancários (agência/conta)</li>
          <li>Faça o upload do seu certificado digital A1 (.pfx)</li>
          <li>Envie seus XMLs de NF-e e emita em segundos</li>
        </ol>
        ${btn('Acessar o Painel', appUrl + '/app')}
        ${p('<small style="font-size:12px;color:rgba(255,255,255,0.35);">Dúvidas? Responda este e-mail ou acesse nossa central de ajuda.</small>')}
    `);

    return sendEmail({ to, subject: `Bem-vindo ao Apex GNRE, ${name || razaoSocial}!`, html });
}

/**
 * Confirmação de pagamento / fatura paga
 */
async function sendPaymentSuccessEmail({ to, name, valor, plano, periodoFim, invoiceUrl }) {
    const appUrl = process.env.APP_URL || 'https://apex.grupoaliado.com.br';
    const valorFmt = Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataFmt = periodoFim ? new Date(periodoFim).toLocaleDateString('pt-BR') : '—';

    const html = baseTemplate(`
        ${h1('Pagamento confirmado ✅')}
        ${p(`Olá, <strong style="color:#fff;">${name}</strong>! Seu pagamento foi processado com sucesso.`)}
        ${infoTable([
            ['Valor pago', valorFmt],
            ['Plano', plano],
            ['Próxima cobrança', dataFmt],
            ['Status da assinatura', '✅ Ativo']
        ])}
        ${btn('Ver fatura completa', invoiceUrl || appUrl + '/app')}
        ${p('<small style="font-size:12px;color:rgba(255,255,255,0.35);">Guarde este e-mail como comprovante do seu pagamento.</small>')}
    `);

    return sendEmail({ to, subject: `Pagamento confirmado — ${valorFmt} · Apex GNRE`, html });
}

/**
 * Aviso de falha no pagamento
 */
async function sendPaymentFailedEmail({ to, name, valor, motivoFalha, linkPagamento }) {
    const appUrl = process.env.APP_URL || 'https://apex.grupoaliado.com.br';
    const valorFmt = Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const html = baseTemplate(`
        ${h1('Problema no pagamento ⚠️')}
        ${p(`Olá, <strong style="color:#fff;">${name}</strong>. Não conseguimos processar seu pagamento.`)}
        ${alert(`⚠️ ${motivoFalha || 'Cartão recusado. Verifique os dados do cartão ou use outro método de pagamento.'}`)}
        ${infoTable([
            ['Valor', valorFmt],
            ['Status', '❌ Não pago'],
            ['Consequência', 'Acesso suspenso em 15 dias se não regularizado']
        ])}
        ${p('Clique abaixo para regularizar agora e manter o acesso à plataforma:')}
        ${btn('Regularizar pagamento', linkPagamento || appUrl + '/app')}
        ${p('<small style="font-size:12px;color:rgba(255,255,255,0.35);">Precisa de ajuda? Responda este e-mail.</small>')}
    `);

    return sendEmail({ to, subject: `⚠️ Pagamento não processado — Ação necessária · Apex GNRE`, html });
}

/**
 * Aviso de cota próxima ao limite (80% ou 100%)
 */
async function sendQuotaWarningEmail({ to, name, used, quota, percent }) {
    const appUrl = process.env.APP_URL || 'https://apex.grupoaliado.com.br';
    const is100 = percent >= 100;

    const html = baseTemplate(`
        ${h1(is100 ? 'Cota mensal esgotada 🔴' : 'Você está chegando no limite 🟡')}
        ${p(`Olá, <strong style="color:#fff;">${name}</strong>. ${is100
            ? 'Sua cota mensal de guias foi totalmente utilizada. Novas emissões estão bloqueadas até a renovação ou upgrade de plano.'
            : `Você já utilizou <strong style="color:#f59e0b;">${percent}%</strong> da sua cota mensal.`
        }`)}
        ${infoTable([
            ['Guias emitidas', `${used} de ${quota}`],
            ['Uso', `${percent}%`],
            ['Renovação', 'No início do próximo mês']
        ])}
        ${is100
            ? alert('🔴 Emissão de novas guias bloqueada. Faça upgrade de plano para continuar.', '#ef4444')
            : alert('🟡 Considere fazer upgrade de plano para garantir continuidade operacional.', '#f59e0b')
        }
        ${btn('Ver planos disponíveis', appUrl + '/plans')}
    `);

    const subject = is100
        ? '🔴 Cota esgotada — Emissão bloqueada · Apex GNRE'
        : `🟡 ${percent}% da cota mensal utilizada · Apex GNRE`;

    return sendEmail({ to, subject, html });
}

/**
 * Aviso de vencimento de certificado digital PFX
 */
async function sendCertExpiryEmail({ to, name, expiresAt, daysLeft }) {
    const appUrl = process.env.APP_URL || 'https://apex.grupoaliado.com.br';
    const dataFmt = new Date(expiresAt).toLocaleDateString('pt-BR');
    const isUrgent = daysLeft <= 7;

    const html = baseTemplate(`
        ${h1(`Certificado digital vence em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} ${isUrgent ? '🚨' : '⚠️'}`)}
        ${p(`Olá, <strong style="color:#fff;">${name}</strong>. Seu certificado digital A1 está próximo do vencimento.`)}
        ${infoTable([
            ['Vencimento', dataFmt],
            ['Dias restantes', `${daysLeft} dias`],
            ['Impacto', 'Emissão de GNRE ficará indisponível após vencimento']
        ])}
        ${isUrgent
            ? alert('🚨 URGENTE: Renove seu certificado imediatamente para evitar interrupção nas emissões.', '#ef4444')
            : alert('⚠️ Renove com antecedência para garantir continuidade operacional.', '#f59e0b')
        }
        ${p('Após renovar com sua certificadora, faça o upload do novo certificado no painel:')}
        ${btn('Atualizar certificado', appUrl + '/app?tab=config')}
    `);

    const subject = isUrgent
        ? `🚨 URGENTE: Certificado vence em ${daysLeft} dias · Apex GNRE`
        : `⚠️ Certificado digital vence em ${daysLeft} dias · Apex GNRE`;

    return sendEmail({ to, subject, html });
}

/**
 * Aviso de trial expirando
 */
async function sendTrialExpiringEmail({ to, name, daysLeft }) {
    const appUrl = process.env.APP_URL || 'https://apex.grupoaliado.com.br';

    const html = baseTemplate(`
        ${h1(`Seu trial expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} ⏳`)}
        ${p(`Olá, <strong style="color:#fff;">${name}</strong>. Seu período de trial gratuito está quase encerrando.`)}
        ${p('Assine um plano agora e continue automatizando o recolhimento de GNRE sem interrupção:')}
        ${infoTable([
            ['Plano Starter', 'R$ 199/mês · 100 guias/mês'],
            ['Plano Pro', 'R$ 399/mês · 500 guias/mês'],
            ['Plano Advanced', 'R$ 699/mês · 1.500 guias/mês']
        ])}
        ${btn('Assinar agora', appUrl + '/plans')}
        ${p('<small style="font-size:12px;color:rgba(255,255,255,0.35);">Sem fidelidade. Cancele quando quiser.</small>')}
    `);

    return sendEmail({ to, subject: `⏳ Seu trial Apex encerra em ${daysLeft} dias · Aproveite agora`, html });
}

module.exports = {
    sendWelcomeEmail,
    sendPaymentSuccessEmail,
    sendPaymentFailedEmail,
    sendQuotaWarningEmail,
    sendCertExpiryEmail,
    sendTrialExpiringEmail
};
