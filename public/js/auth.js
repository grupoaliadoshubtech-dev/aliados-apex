// public/js/auth.js
// Lógica de Autenticação do Cliente SaaS

// Interceptador global do fetch com renovação automática de sessão JWT (refresh token)
const originalFetch = window.fetch;
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
}

async function renoveSession() {
    const refreshToken = localStorage.getItem('sb_refresh_token');
    if (!refreshToken) return null;

    try {
        const res = await originalFetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        if (!res.ok) {
            localStorage.removeItem('sb_access_token');
            localStorage.removeItem('sb_refresh_token');
            localStorage.removeItem('sb_expires_at');
            return null;
        }

        const data = await res.json();
        if (data.token) {
            localStorage.setItem('sb_access_token', data.token);
            if (data.refreshToken) localStorage.setItem('sb_refresh_token', data.refreshToken);
            if (data.expiresAt) localStorage.setItem('sb_expires_at', data.expiresAt);
            return data.token;
        }
        return null;
    } catch (e) {
        console.error('[Auth] Erro ao renovar token:', e);
        return null;
    }
}

window.fetch = async function (resource, options = {}) {
    const url = typeof resource === 'string' ? resource : (resource ? resource.url : '');
    const isApiRequest = url && (url.startsWith('/api/') || url.includes('/api/'));
    const isAuthRoute = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/refresh');

    if (isApiRequest && !isAuthRoute) {
        let token = localStorage.getItem('sb_access_token');

        // Se o token estiver expirado ou muito próximo (a menos de 60s), tenta renovar antes de enviar
        const expiresAt = localStorage.getItem('sb_expires_at');
        const nowInSeconds = Math.floor(Date.now() / 1000);
        if (expiresAt && (Number(expiresAt) - nowInSeconds) < 60) {
            if (!isRefreshing) {
                isRefreshing = true;
                const newToken = await renoveSession();
                isRefreshing = false;
                if (newToken) {
                    token = newToken;
                    onRefreshed(newToken);
                }
            }
        }

        if (token) {
            if (!options.headers) options.headers = {};
            if (options.headers instanceof Headers) {
                options.headers.set('Authorization', `Bearer ${token}`);
            } else {
                options.headers['Authorization'] = `Bearer ${token}`;
            }
        }
    }

    const response = await originalFetch(resource, options);

    // Se receber 401 em uma rota protegida, tenta renovar e repetir a requisição
    if (response.status === 401 && isApiRequest && !isAuthRoute) {
        const refreshToken = localStorage.getItem('sb_refresh_token');
        if (refreshToken) {
            if (!isRefreshing) {
                isRefreshing = true;
                const newToken = await renoveSession();
                isRefreshing = false;
                if (newToken) {
                    onRefreshed(newToken);
                    // Re-tenta a requisição original com o novo token
                    const retryOptions = { ...options };
                    if (!retryOptions.headers) retryOptions.headers = {};
                    if (retryOptions.headers instanceof Headers) {
                        retryOptions.headers.set('Authorization', `Bearer ${newToken}`);
                    } else {
                        retryOptions.headers['Authorization'] = `Bearer ${newToken}`;
                    }
                    return originalFetch(resource, retryOptions);
                } else {
                    // Refresh falhou: sessão expirada de fato
                    window.location.href = '/login.html';
                }
            } else {
                // Aguarda a renovação em andamento
                return new Promise((resolve) => {
                    refreshSubscribers.push(async (newToken) => {
                        if (newToken) {
                            const retryOptions = { ...options };
                            if (!retryOptions.headers) retryOptions.headers = {};
                            if (retryOptions.headers instanceof Headers) {
                                retryOptions.headers.set('Authorization', `Bearer ${newToken}`);
                            } else {
                                retryOptions.headers['Authorization'] = `Bearer ${newToken}`;
                            }
                            resolve(await originalFetch(resource, retryOptions));
                        } else {
                            resolve(response);
                        }
                    });
                });
            }
        }
    }

    return response;
};

const toast = document.getElementById('toast');

function showToast(message, type = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 4000);
}

// Lógica de Cadastro
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const cnpj = document.getElementById('cnpj').value;
        const razao_social = document.getElementById('razao_social').value;
        const plan = document.getElementById('plan').value;

        // Inclui consentimentos LGPD se disponíveis na página
        const extraFields = (typeof window.getExtraRegisterFields === 'function')
            ? window.getExtraRegisterFields()
            : {};

        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Aguarde...'; }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, cnpj, razao_social, plan, ...extraFields })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Falha no cadastramento.');
            }

            showToast("Cadastro realizado com sucesso! Redirecionando...", 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
        } catch (err) {
            showToast(err.message, 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Finalizar Cadastro'; }
        }
    });
}

// Lógica de Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'E-mail ou senha incorretos.');
            }

            // Armazena tokens e expiração no localStorage
            localStorage.setItem('sb_access_token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('sb_refresh_token', data.refreshToken);
            }
            if (data.expiresAt) {
                localStorage.setItem('sb_expires_at', data.expiresAt);
            }

            showToast("Login bem-sucedido! Acessando painel...", 'success');
            setTimeout(() => {
                window.location.href = '/app';
            }, 1000);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Função de Logoff global
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
        localStorage.removeItem('sb_expires_at');
        window.location.href = '/login.html';
    } catch (e) {
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
        localStorage.removeItem('sb_expires_at');
        window.location.href = '/login.html';
    }
}
