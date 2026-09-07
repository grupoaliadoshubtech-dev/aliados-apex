// worker/jobs/expire_trials.js
// Job pg-boss: expira trials vencidos e envia e-mail de aviso 3 dias antes
//
// Agendamento (no worker/index.js):
//   boss.schedule('expire-trials', '0 9 * * *');  // todo dia às 09:00

const { supabaseAdmin } = require('../../api/utils/supabase');
const { sendTrialExpiringEmail } = require('../../services/email_service');

const JOB_NAME = 'expire-trials';

async function handler(job) {
    console.log('[expire-trials] 🕘 Iniciando verificação de trials...');
    const now = new Date();

    // ─────────────────────────────────────────────────────────────
    // 1. Aviso antecipado: trials que vencem em 3 dias
    // ─────────────────────────────────────────────────────────────
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const { data: expiringSoon, error: warnErr } = await supabaseAdmin
        .from('tenants')
        .select('id, razao_social, trial_ends_at, stripe_customer_id')
        .eq('subscription_status', 'trial')
        .gte('trial_ends_at', now.toISOString())
        .lte('trial_ends_at', in3Days.toISOString());

    if (warnErr) console.error('[expire-trials] Erro ao buscar trials prestes a vencer:', warnErr.message);

    for (const tenant of (expiringSoon || [])) {
        try {
            // Busca o e-mail do usuário principal do tenant
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('email, name')
                .eq('tenant_id', tenant.id)
                .limit(1).single();

            if (profile?.email) {
                const daysLeft = Math.ceil(
                    (new Date(tenant.trial_ends_at) - now) / (1000 * 60 * 60 * 24)
                );
                await sendTrialExpiringEmail({
                    to: profile.email,
                    name: profile.name || tenant.razao_social,
                    daysLeft
                });
                console.log(`[expire-trials] ⚠️  Aviso enviado: ${tenant.razao_social} (${daysLeft} dias)`);
            }
        } catch (e) {
            console.error(`[expire-trials] Falha no aviso para ${tenant.id}:`, e.message);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Expirar trials vencidos (trial_ends_at <= agora)
    // ─────────────────────────────────────────────────────────────
    const { data: expired, error: expErr } = await supabaseAdmin
        .from('tenants')
        .select('id, razao_social')
        .eq('subscription_status', 'trial')
        .lt('trial_ends_at', now.toISOString());

    if (expErr) console.error('[expire-trials] Erro ao buscar trials expirados:', expErr.message);

    if (expired?.length) {
        const ids = expired.map(t => t.id);

        const { error: updateErr } = await supabaseAdmin
            .from('tenants')
            .update({ subscription_status: 'trial_expirado' })
            .in('id', ids);

        if (updateErr) {
            console.error('[expire-trials] Erro ao expirar trials:', updateErr.message);
        } else {
            console.log(`[expire-trials] 🔴 ${ids.length} trial(s) expirado(s):`,
                expired.map(t => t.razao_social).join(', '));
        }
    } else {
        console.log('[expire-trials] ✅ Nenhum trial expirado hoje.');
    }

    return { expiredCount: expired?.length || 0, warnedCount: expiringSoon?.length || 0 };
}

module.exports = { JOB_NAME, handler };
