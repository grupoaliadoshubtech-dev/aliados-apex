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
-- 7. FUNÇÃO OTIMIZADA PARA RLS: public.get_my_tenant_id()
-- Criada no schema PUBLIC (SQL Editor não tem permissão no schema auth)
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
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
    USING (id = public.get_my_tenant_id());

CREATE POLICY "Tenant pode atualizar seus dados" ON tenants
    FOR UPDATE TO authenticated
    USING (id = public.get_my_tenant_id());

-- Políticas para PROFILES
CREATE POLICY "Usuarios podem ver perfil do seu tenant" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR tenant_id = public.get_my_tenant_id());

CREATE POLICY "Usuarios podem atualizar seu proprio perfil" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- Políticas para BATCHES
CREATE POLICY "Tenant pode acessar seus lotes" ON batches
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant pode criar lotes" ON batches
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant pode atualizar seus lotes" ON batches
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

-- Políticas para GUIDES
CREATE POLICY "Tenant pode acessar suas guias" ON guides
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Tenant pode inserir suas guias" ON guides
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Políticas para USAGE_METER
CREATE POLICY "Tenant pode ver seu historico de uso" ON usage_meter
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

-- ========================================================
-- OBSERVAÇÕES DE STORAGE BUCKET:
-- Crie o bucket privado "tenant-storage" no painel do Supabase.
-- Estrutura de pastas isolada por tenant:
--   - [tenant_id]/certificados/
--   - [tenant_id]/guias/
--   - [tenant_id]/remessas/
-- ========================================================

-- ========================================================
-- SCHEMA v2.1.0 — TABELAS COMPLEMENTARES PARA STRIPE E LGPD
-- Execute este bloco no editor SQL do Supabase após o schema base
-- NOTA: A função auth.get_my_tenant_id() já deve existir do schema base.
--       Se não existir, rode o schema base completo primeiro (linhas 1-169).
-- ========================================================

-- 9. Tabela de Logs de Webhook do Stripe
CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processado BOOLEAN DEFAULT false,
    erro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON stripe_webhook_logs(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processado ON stripe_webhook_logs(processado);

-- 10. Tabela de Faturas do Stripe
CREATE TABLE IF NOT EXISTS stripe_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) NOT NULL,  -- paid, failed, open, draft
    tentativas_cobranca INTEGER DEFAULT 0,
    proxima_tentativa_em TIMESTAMP WITH TIME ZONE,
    motivo_falha TEXT,
    pago_em TIMESTAMP WITH TIME ZONE,
    vencimento TIMESTAMP WITH TIME ZONE,
    link_pagamento TEXT,
    pdf_url TEXT,
    tipo VARCHAR(50) DEFAULT 'assinatura',  -- assinatura, avulso
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON stripe_invoices(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON stripe_invoices(status);

-- 11. Tabela de Assinaturas Ativas (Stripe Subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_price_id VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    plano VARCHAR(50) NOT NULL DEFAULT 'pro',
    valor NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, past_due, canceled, trialing
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- 12. Tabela de Consentimento / Aceite de Termos (LGPD)
CREATE TABLE IF NOT EXISTS consent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    tipo VARCHAR(100) NOT NULL,          -- 'termos_de_uso', 'politica_privacidade'
    versao VARCHAR(20) NOT NULL,         -- ex: 'v1.0'
    ip_address INET,
    user_agent TEXT,
    aceito_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_log(user_id);

-- 13. Tabela de Auditoria (LGPD — rastreabilidade de acesso)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,    -- ex: 'login', 'upload_pfx', 'download_guia', 'batch_process'
    detalhe JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- 14. View de Inadimplentes (agregação sobre stripe_invoices + tenants)
-- DROP primeiro para evitar erro "cannot drop columns from view"
DROP VIEW IF EXISTS view_inadimplentes;
CREATE OR REPLACE VIEW view_inadimplentes AS
SELECT
    t.id             AS tenant_id,
    t.razao_social,
    t.cnpj,
    t.stripe_customer_id,
    t.subscription_status,
    si.stripe_invoice_id,
    si.valor,
    si.motivo_falha,
    si.vencimento,
    si.link_pagamento
FROM tenants t
JOIN stripe_invoices si ON si.stripe_customer_id = t.stripe_customer_id
WHERE si.status = 'failed'
  AND t.subscription_status = 'inadimplente';


-- ========================================================
-- RLS para tabelas novas (acesso apenas via service role no backend)
-- stripe_webhook_logs, stripe_invoices e subscriptions são gerenciados
-- exclusivamente pelo backend com service_role_key — sem acesso direto de clientes
-- ========================================================
ALTER TABLE stripe_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Clientes só enxergam suas próprias faturas
CREATE POLICY "Tenant ve suas faturas" ON stripe_invoices
    FOR SELECT TO authenticated
    USING (
        stripe_customer_id = (
            SELECT stripe_customer_id FROM tenants
            WHERE id = public.get_my_tenant_id() LIMIT 1
        )
    );

-- Clientes só enxergam suas próprias assinaturas
CREATE POLICY "Tenant ve sua assinatura" ON subscriptions
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

-- Clientes só enxergam seus próprios consentimentos
CREATE POLICY "Usuario ve seus consentimentos" ON consent_log
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

