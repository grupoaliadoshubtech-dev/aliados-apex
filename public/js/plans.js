// public/js/plans.js
// Lógica para carregamento, checkout e gestão de planos SaaS via Stripe

let currentTenantData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await carregarDados();
});

async function carregarDados() {
    try {
        // Reseta todos os cards e botões com os valores padrão
        resetarCardsEBotoes();

        // Tenta buscar informações de autenticação (se o usuário estiver logado)
        const token = localStorage.getItem('sb_access_token');
        if (!token) {
            // Visitante anônimo: mantém os planos abertos e botões apontando para cadastro
            return;
        }

        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            // Token expirado ou inválido: limpa e permite navegação anônima
            localStorage.removeItem('sb_access_token');
            return;
        }

        const data = await res.json();
        
        // Verifica se é administrador para liberar o botão de administração
        if (data.profile && data.profile.is_admin) {
            const adminLink = document.getElementById('admin-nav-link');
            if (adminLink) adminLink.classList.remove('d-none');
        }

        const tenant = Array.isArray(data.tenant) ? data.tenant[0] : data.tenant;
        currentTenantData = tenant;

        const planName = (tenant && tenant.plan) || 'trial';
        const subStatus = (tenant && tenant.subscription_status) || 'ativo';

        // Atualiza banner do portal Stripe se o cliente tiver stripe_customer_id ou plano pago
        const portalBanner = document.getElementById('stripe-portal-banner');
        if (portalBanner) {
            if (tenant && (tenant.stripe_customer_id || (planName !== 'trial' && subStatus === 'ativo'))) {
                portalBanner.style.display = 'flex';
                const planNameEl = document.getElementById('portal-plan-name');
                const planStatusEl = document.getElementById('portal-plan-status');
                if (planNameEl) planNameEl.textContent = planName;
                if (planStatusEl) {
                    planStatusEl.textContent = subStatus === 'ativo' ? 'Ativo' : subStatus;
                    planStatusEl.style.color = subStatus === 'ativo' ? 'var(--success)' : '#f59e0b';
                }
            } else {
                portalBanner.style.display = 'none';
            }
        }

        // Reseta todos os cards e botões antes de marcar o ativo
        resetarCardsEBotoes();

        // Destaca o plano atual
        destacarPlanoAtivo(planName);

    } catch (e) {
        showToast("Erro ao carregar dados dos planos: " + e.message, 'error');
    }
}

function resetarCardsEBotoes() {
    const plans = ['starter', 'pro', 'advanced'];
    
    plans.forEach(p => {
        const card = document.getElementById(`card-${p}`);
        if (card) {
            card.classList.remove('active-plan');
        }

        const btnEl = document.getElementById(`btn-${p}`);
        if (btnEl && btnEl.parentNode) {
            const containerBotoes = btnEl.parentNode;
            containerBotoes.innerHTML = `
                <button onclick="selecionarPlano('${p}')" id="btn-${p}" class="btn ${p === 'pro' ? 'btn-primary' : 'btn-secondary'}" style="width: 100%;">
                    Assinar Plano ${p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
            `;
        }
    });
}

function destacarPlanoAtivo(plan) {
    const activeKey = (plan || '').toLowerCase();
    const card = document.getElementById(`card-${activeKey}`);
    if (card) {
        card.classList.add('active-plan');
    }

    const btnEl = document.getElementById(`btn-${activeKey}`);
    if (btnEl && btnEl.parentNode) {
        btnEl.parentNode.innerHTML = `
            <div class="plan-badge-active" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
                <span>✔</span> Seu Plano Atual
            </div>
        `;
    }
}

/**
 * Inicia checkout Stripe para o plano selecionado
 */
async function selecionarPlano(plan) {
    if (!currentTenantData) {
        showToast("Crie sua conta para assinar ou testar o plano!", "info");
        setTimeout(() => {
            window.location.href = `/register.html?plan=${plan}`;
        }, 800);
        return;
    }

    if (currentTenantData && currentTenantData.plan === plan && currentTenantData.subscription_status === 'ativo') {
        showToast(`Você já está no Plano ${plan.toUpperCase()}! Para alterar dados de cobrança, use o Portal Stripe.`, 'info');
        return;
    }

    try {
        showToast(`Iniciando checkout seguro do Plano ${plan.toUpperCase()}...`, "warning");
        
        const res = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Não foi possível iniciar o checkout.');
        }

        if (data.url) {
            showToast("Redirecionando para o Stripe Checkout seguro...", "success");
            window.location.href = data.url;
        } else {
            throw new Error("URL de checkout não retornada pelo servidor.");
        }

    } catch (e) {
        console.error('[Checkout Error]:', e);
        showToast("Erro no pagamento: " + e.message, 'error');
    }
}

/**
 * Abre o Stripe Customer Portal para gerenciamento de assinatura e cartões
 */
async function abrirPortalStripe() {
    try {
        showToast("Abrindo Portal do Cliente Stripe...", "warning");

        const res = await fetch('/api/stripe/create-portal-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Não foi possível abrir o portal de assinaturas.');
        }

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error("URL do portal não retornada.");
        }
    } catch (e) {
        console.error('[Portal Error]:', e);
        showToast("Erro ao acessar portal: " + e.message, 'error');
    }
}
