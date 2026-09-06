// api/utils/supabase.js
// Cliente Supabase centralizado para o backend com fallbacks seguros

const { createClient } = require('@supabase/supabase-js');

// Configurações padrão do projeto caso as variáveis da Vercel ainda não tenham propagado
const DEFAULT_SUPABASE_URL = 'https://ifgcenlkaisdknxjtjla.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZ2NlbmxrYWlzZGtueGp0amxhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTU4NzA1OSwiZXhwIjoyMDk3MTYzMDU5fQ.GRFxAsB9IcejrRciP-VYebMspfaM7b23lPBeG5jIuto';

function getSupabaseUrl() {
    let url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    if (typeof url === 'string') {
        url = url.trim().replace(/^["']+|["']+$/g, '').trim();
    }
    return url || DEFAULT_SUPABASE_URL;
}

function getSupabaseKey() {
    let key = process.env.SUPABASE_KEY;
    if (key && typeof key === 'string') {
        key = key.trim().replace(/^["']+|["']+$/g, '').trim();
        try {
            const parts = key.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                if (payload && payload.ref === 'ifgcenlkaisdknxjtjla') {
                    return key;
                }
            }
        } catch (e) {
            console.warn("⚠️ SUPABASE_KEY no ambiente não é um JWT válido.");
        }
        console.warn("⚠️ SUPABASE_KEY no ambiente é inválida ou de outro projeto. Usando fallback seguro.");
    }
    return DEFAULT_SUPABASE_KEY;
}

// Cliente Admin com service_role (operações administrativas do sistema e storage)
const supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper para criar cliente temporário com token de usuário (para validação segura sem poluir estado global)
function createScopedClient(accessToken) {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        global: accessToken ? {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        } : {}
    });
}

module.exports = {
    supabaseAdmin,
    createScopedClient,
    getSupabaseUrl,
    getSupabaseKey
};
