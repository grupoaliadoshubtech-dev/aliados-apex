// api/utils/supabase.js
// Cliente Supabase centralizado para o backend com fallbacks seguros

const { createClient } = require('@supabase/supabase-js');

// Configurações padrão do projeto caso as variáveis da Vercel ainda não tenham propagado
const DEFAULT_SUPABASE_URL = 'https://ifgcenlkaisdknxjtjla.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZ2NlbmxrYWlzZGtueGp0amxhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTU4NzA1OSwiZXhwIjoyMDk3MTYzMDU5fQ.GRFxAsB9IcejrRciP-VYebMspfaM7b23lPBeG5jIuto';

function getSupabaseUrl() {
    return process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

function getSupabaseKey() {
    return process.env.SUPABASE_KEY || DEFAULT_SUPABASE_KEY;
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
