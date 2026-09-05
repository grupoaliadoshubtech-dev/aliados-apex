// api/utils/supabase.js
// Cliente Supabase centralizado para o backend

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ AVISO: SUPABASE_URL ou SUPABASE_KEY não configurados no ambiente.");
}

// Cliente Admin com service_role (operações administrativas do sistema e storage)
const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper para criar cliente temporário com token de usuário (para validação segura sem poluir estado global)
function createScopedClient(accessToken) {
    return createClient(supabaseUrl, supabaseKey, {
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
    createScopedClient
};
