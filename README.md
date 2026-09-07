# 🚀 Apex GNRE SaaS — Grupo Aliados Hub Tech
> Plataforma SaaS Corporativa Multi-Tenant para Automação Fiscal de Guias GNRE em Lote e Geração de Remessas Bancárias Itaú SISPAG CNAB 240.

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-v5.2-blue?logo=express)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20RLS-3ECF8E?logo=supabase)
![Stripe](https://img.shields.io/badge/Stripe-Subscriptions%20%26%20Billing-635BFF?logo=stripe)
![Resend](https://img.shields.io/badge/Resend-Transactional%20Emails-black)
![Sentry](https://img.shields.io/badge/Sentry-Error%20Tracking%20v8-362D59?logo=sentry)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 📑 Sumário Executivo

O **Apex GNRE SaaS** resolve um dos maiores gargalos operacionais do varejo digital e e-commerce interestadual no Brasil: o cálculo, preenchimento manual, transmissão perante as Secretarias de Fazenda estaduais (SEFAZ) e recolhimento bancário de tributos (**DIFAL**, **FCP** e **ICMS-ST**).

A plataforma permite que uma empresa importe centenas de arquivos XML de Notas Fiscais Eletrônicas (NF-e modelo 55), valide alíquotas por UF de destino, assine os lotes com o Certificado Digital A1 da própria empresa via mTLS e gere instantaneamente:
1. **PDFs oficiais das guias GNRE** autorizadas para acompanhar as mercadorias;
2. **Arquivo de Remessa Bancária Itaú SISPAG CNAB 240** formatado para liquidação automática via Internet Banking, sem necessidade de digitação manual de código de barras.

---

## 🏛️ Arquitetura do Sistema

```
                         [ CLIENTE / BROWSER ]
                   (Landing Page / Painel Web / Onboarding)
                                   │
                                   ▼
                   [ API GATEWAY — Express 5 / Vercel ]
            (Rate Limit, Helmet CSP, Zod Validation, JWT Auth)
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
   [ SUPABASE DB ]         [ STRIPE BILLING ]       [ RESEND EMAILS ]
 (PostgreSQL + RLS,       (Checkout Sessions,       (Boas-vindas, Faturas,
  Storage de PDFs/PFX)     Portal, Webhooks)         Alertas de Expiração)
         │
         ▼
  [ WORKER PERSISTENTE — Railway / Render ]
    (pg-boss Queue, Processamento em Segundo Plano,
     Agendador Diário de Expiração de Trials)
         │
         ▼
  [ SEFAZ / PORTAL GNRE ]
    (Comunicação mTLS com Certificado Digital A1)
```

---

## 🔐 Segurança e Multi-Tenancy

* **Isolamento de Dados (RLS):** Toda query no banco passa por PostgreSQL Row-Level Security (`tenant_id = public.get_my_tenant_id()`). Uma empresa nunca enxerga dados de outra.
* **Criptografia Simétrica de Certificados A1:** Senhas de arquivos `.pfx` são criptografadas em repouso com algoritmo AES-256 (`ENCRYPTION_KEY` de 32 caracteres).
* **Armazenamento Privado de Certificados:** Arquivos `.pfx` e PDFs de guias ficam armazenados em buckets privados no Supabase Storage (`tenant-storage/{tenant_id}/...`).
* **Proteção contra Força Bruta:** Middleware `express-rate-limit` restringe tentativas de login e cadastros (10 requisições / 15 min) e envio de lotes (5 envios / min).
* **Segurança HTTP:** `helmet` configurado com Content Security Policy (CSP) estrito compatível com Stripe Elements/Portal e Google Fonts.
* **Conformidade LGPD:** Todo cadastro exige aceite explícito de Termos de Uso e Política de Privacidade, gravando IP, User-Agent e Timestamp em tabela de auditoria imutável (`consent_log`).

---

## 📦 Stack Tecnológica

| Camada | Tecnologia | Propósito |
|---|---|---|
| **Runtime & Servidor** | Node.js v18+ & Express 5.2 | API REST e servidor web leve |
| **Banco de Dados** | Supabase (PostgreSQL 15) | Persistência com RLS e Auth JWT |
| **Armazenamento de Arquivos** | Supabase Storage | Certificados PFX e Remessas persistentes |
| **Faturamento Recorrente** | Stripe API v22+ | Assinaturas, Checkout e Portal do Cliente |
| **E-mails Transacionais** | Resend API v6+ | Envio de e-mails com templates HTML |
| **Monitoramento de Erros** | Sentry Node v8+ | Rastreamento de exceções com PII scrubbing |
| **Fila Assíncrona** | pg-boss v12+ | Filas transacionais no PostgreSQL |
| **Validação de Dados** | Zod v3+ | Schemas rigorosos de entrada nas rotas |
| **Design System** | Aliado Design System v2 | Identidade visual proprietária (Deep Navy / Linen) |

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```bash
# Servidor
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_service_role_key_aqui

# Criptografia de Senhas PFX (exatamente 32 caracteres)
ENCRYPTION_KEY=d7b5f12a893e4b0c7a6d9f8e5c3b2a10

# Administrador
ADMIN_PASSWORD=sua_senha_mestra_admin

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ADVANCED=price_...

# Resend (E-mails)
RESEND_API_KEY=re_...
EMAIL_FROM="Apex GNRE <faturamento@aliadohubtech.com.br>"

# Sentry (Monitoramento)
SENTRY_DSN=https://...@sentry.io/...
```

> **Aviso de Segurança:** Nunca envie `.env` ou `.env.local` ao Git. Ambos estão devidamente ignorados no `.gitignore`.

---

## 🚀 Como Rodar Localmente

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/grupoaliadoshubtech-dev/aliados-apex.git
cd Web_Services
npm install
```

### 2. Configurar Banco de Dados
Execute o script [schema.sql](file:///c:/Users/Roberto/Documents/Grupo Aliado Hub Tech/Web_Services/schema.sql) diretamente no SQL Editor do seu projeto Supabase para criar as tabelas, RLS policies e views.

### 3. Iniciar o Servidor Web & API
```bash
npm run dev
# Servidor rodará em http://localhost:3000
```

### 4. Iniciar o Worker de Processamento
Em outro terminal (ou via background):
```bash
npm run worker
```

---

## 💳 Tabela de Planos de Assinatura

| Plano | Preço Mensal | Limite de Guias | Transmissão mTLS | Remessa SISPAG 240 | Suporte |
|---|---|---|---|---|---|
| **Trial Gratuito** | **R$ 0** | Até 10 guias/mês | Homologação/Simulado | Sim | Fórum |
| **Starter** | **R$ 199** | Até 100 guias/mês | Sim (Todas as SEFAZs) | Sim (Itaú 240) | Comercial |
| **Pro (Recomendado)** | **R$ 399** | Até 500 guias/mês | Sim (Múltiplos PFX) | Sim (Itaú 240) | Prioritário |
| **Advanced** | **R$ 699** | Até 1.500 guias/mês | Sim (APIs Dedicadas) | Sim (Itaú 240) | 24/7 Dedicado |
| **Taxa de Setup** | **R$ 600** (Única) | Parametrização A1 + Homologação bancária ponta a ponta com tesouraria |

---

## 🌐 Rotas da Interface Web

* **Landing Page:** `http://localhost:3000/`
* **Painel Principal:** `http://localhost:3000/app`
* **Tabela de Planos:** `http://localhost:3000/plans.html`
* **Configurações da Empresa:** `http://localhost:3000/profile.html`
* **Cadastro Corporativo:** `http://localhost:3000/register.html`
* **Acesso / Login:** `http://localhost:3000/login.html`
* **Central de Status & Saúde:** `http://localhost:3000/health`
* **Termos de Uso (LGPD):** `http://localhost:3000/termos.html`
* **Política de Privacidade (LGPD):** `http://localhost:3000/privacidade.html`

---

## 📡 Referência Rápida da API REST

### 1. Autenticação & Sessão (`/api/auth`)
* `POST /api/auth/register` — Cadastra empresa, perfil, credenciais e registra aceite LGPD.
* `POST /api/auth/login` — Autentica usuário e retorna `token`, `refreshToken` e cookie seguro.
* `POST /api/auth/refresh` — Renova token JWT expirado de forma silenciosa via refresh token.
* `GET /api/auth/me` — Retorna dados do usuário autenticado e dados do seu tenant.
* `POST /api/auth/logout` — Destrói a sessão e limpa cookies.

### 2. Configurações da Empresa (`/api/tenant`)
* `POST /api/tenant/settings` — Atualiza Razão Social, CNPJ, dados bancários (Agência/Conta/DAC) e ambiente (Simulado/Produção).
* `POST /api/tenant/upload-pfx` — Recebe arquivo `.pfx`, valida e armazena com criptografia simétrica AES-256.

### 3. Faturamento & Pagamentos (`/api/stripe`)
* `POST /api/stripe/create-checkout-session` — Gera URL do Stripe Checkout para assinatura do plano.
* `POST /api/stripe/create-portal-session` — Gera URL do Stripe Customer Portal para gerenciar cartões, plano e cancelar.
* `GET /api/stripe/subscription` — Retorna status detalhado da assinatura, limites e faturas recentes.
* `POST /api/webhooks/stripe` — Webhook oficial para processamento de eventos do Stripe (`invoice.paid`, `customer.subscription.deleted`, etc.).

### 4. Monitoramento & Infraestrutura
* `GET /health` — Retorna dashboard visual quando acessado por navegadores ou JSON quando acessado por monitoramento.
* `GET /api/health` — Retorna JSON leve com métricas de uptime e latência do Supabase para o UptimeRobot.

---

## 🏗️ Deploy em Produção

Consulte os guias especializados de infraestrutura:
* [WORKER_DEPLOY.md](file:///c:/Users/Roberto/Documents/Grupo Aliado Hub Tech/Web_Services/WORKER_DEPLOY.md) — Configuração do worker persistente no Railway.
* [railway.toml](file:///c:/Users/Roberto/Documents/Grupo Aliado Hub Tech/Web_Services/railway.toml) — Arquivo de infraestrutura como código para o Railway.
* [vercel.json](file:///c:/Users/Roberto/Documents/Grupo Aliado Hub Tech/Web_Services/vercel.json) — Configuração de rotas serverless para a API na Vercel.

---

## 📄 Licença e Propriedade Intelectual

Todo o código-fonte, arquitetura e ativos visuais são propriedade exclusiva do **Grupo Aliados Hub Tech Ltda**. Todos os direitos reservados.
