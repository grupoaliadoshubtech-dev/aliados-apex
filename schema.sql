-- ========================================================
-- APEX GNRE SAAS - SCHEMA COMPLETO COM RLS (v2.0.0)
-- Execute este script no editor SQL do painel do Supabase
-- ========================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Tenants (Empresas / Inquilinos SaaS)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    cnpj VARCHAR(14) UNIQUE NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    bank_agency VARCHAR(4) NOT NULL,
    bank_account VARCHAR(5) NOT NULL,
    bank_dac VARCHAR(1) NOT NULL,
    pfx_passphrase_encrypted TEXT,
    pfx_filename VARCHAR(255),
    environment VARCHAR(20) DEFAULT 'simulado',
    plan VARCHAR(50) DEFAULT 'trial',
    monthly_quota INTEGER DEFAULT 10,
    used_this_month INTEGER DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'ativo',
    cert_expires_at TIMESTAMP WITH TIME ZONE
);

-- 3. Tabela de Perfis de Usuários (Vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Lotes de GNRE (Batches)
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    environment VARCHAR(20) NOT NULL,
    receipt VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, sucesso, erro
    error_message TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Guias Emitidas (Guides)
CREATE TABLE IF NOT EXISTS guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    nf_number VARCHAR(50) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    barcode VARCHAR(48),
    line_digitizable VARCHAR(48),
    storage_path TEXT, -- Caminho no Supabase Storage: [tenant_id]/guias/[nf].html
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Medição de Uso (Usage Meter)
CREATE TABLE IF NOT EXISTS usage_meter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    year_month VARCHAR(7) NOT NULL, -- Formato: 'YYYY-MM' (ex: '2026-09')
    guides_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de performance para busca por tenant e status
CREATE INDEX IF NOT EXISTS idx_tenants_cnpj ON tenants(cnpj);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batches_tenant_status ON batches(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_guides_tenant_batch ON guides(tenant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_period ON usage_meter(tenant_id, year_month);

-- ========================================================
-- 7. FUNÇÃO OTIMIZADA PARA RLS: auth.get_my_tenant_id()
-- Executada de forma estável e segura para evitar subqueries repetitivas
-- ========================================================
CREATE OR REPLACE FUNCTION auth.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ========================================================
-- 8. ROW LEVEL SECURITY (RLS) - POLÍTICAS DE ISOLAMENTO
-- ========================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_meter ENABLE ROW LEVEL SECURITY;

-- Limpar policies anteriores para evitar duplicidade
DROP POLICY IF EXISTS "Tenant pode ver seus proprios dados" ON tenants;
DROP POLICY IF EXISTS "Tenant pode atualizar seus dados" ON tenants;
DROP POLICY IF EXISTS "Usuarios podem ver perfil do seu tenant" ON profiles;
DROP POLICY IF EXISTS "Usuarios podem atualizar seu proprio perfil" ON profiles;
DROP POLICY IF EXISTS "Tenant pode acessar seus lotes" ON batches;
DROP POLICY IF EXISTS "Tenant pode criar lotes" ON batches;
DROP POLICY IF EXISTS "Tenant pode atualizar seus lotes" ON batches;
DROP POLICY IF EXISTS "Tenant pode acessar suas guias" ON guides;
DROP POLICY IF EXISTS "Tenant pode inserir suas guias" ON guides;
DROP POLICY IF EXISTS "Tenant pode ver seu historico de uso" ON usage_meter;

-- Políticas para TENANTS
CREATE POLICY "Tenant pode ver seus proprios dados" ON tenants
    FOR SELECT TO authenticated
    USING (id = auth.get_my_tenant_id());

CREATE POLICY "Tenant pode atualizar seus dados" ON tenants
    FOR UPDATE TO authenticated
    USING (id = auth.get_my_tenant_id());

-- Políticas para PROFILES
CREATE POLICY "Usuarios podem ver perfil do seu tenant" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR tenant_id = auth.get_my_tenant_id());

CREATE POLICY "Usuarios podem atualizar seu proprio perfil" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- Políticas para BATCHES
CREATE POLICY "Tenant pode acessar seus lotes" ON batches
    FOR SELECT TO authenticated
    USING (tenant_id = auth.get_my_tenant_id());

CREATE POLICY "Tenant pode criar lotes" ON batches
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = auth.get_my_tenant_id());

CREATE POLICY "Tenant pode atualizar seus lotes" ON batches
    FOR UPDATE TO authenticated
    USING (tenant_id = auth.get_my_tenant_id());

-- Políticas para GUIDES
CREATE POLICY "Tenant pode acessar suas guias" ON guides
    FOR SELECT TO authenticated
    USING (tenant_id = auth.get_my_tenant_id());

CREATE POLICY "Tenant pode inserir suas guias" ON guides
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = auth.get_my_tenant_id());

-- Políticas para USAGE_METER
CREATE POLICY "Tenant pode ver seu historico de uso" ON usage_meter
    FOR SELECT TO authenticated
    USING (tenant_id = auth.get_my_tenant_id());

-- ========================================================
-- OBSERVAÇÕES DE STORAGE BUCKET:
-- Crie o bucket privado "tenant-storage" no painel do Supabase.
-- Estrutura de pastas isolada por tenant:
--   - [tenant_id]/certificados/
--   - [tenant_id]/guias/
--   - [tenant_id]/remessas/
-- ========================================================
