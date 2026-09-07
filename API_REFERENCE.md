# 📘 Referência Técnica da API REST — Apex GNRE SaaS
> Documentação para desenvolvedores, equipes fiscais e integradores de ERPs.

Todas as rotas de API protegidas exigem o cabeçalho HTTP:
```http
Authorization: Bearer <seu_token_jwt>
```
Alternativamente, se a requisição for feita via navegador na mesma origem, o cookie seguro `sb_access_token` é utilizado automaticamente.

---

## 📑 Índice de Endpoints

1. [Autenticação e Sessão](#1-autenticação-e-sessão)
2. [Gestão de Empresa e Certificado A1](#2-gestão-de-empresa-e-certificado-a1)
3. [Lotes e Emissão de Guias GNRE](#3-lotes-e-emissão-de-guias-gnre)
4. [Assinaturas e Cobrança Stripe](#4-assinaturas-e-cobrança-stripe)
5. [Monitoramento e Health Check](#5-monitoramento-e-health-check)

---

## 1. Autenticação e Sessão

### `POST /api/auth/register`
Cadastra uma nova empresa na plataforma, cria as credenciais no Supabase Auth e registra o consentimento legal LGPD.

**Headers:**
`Content-Type: application/json`

**Corpo da Requisição (JSON):**
```json
{
  "name": "Roberto da Silva",
  "email": "financeiro@suaempresa.com.br",
  "password": "senhaForte123*",
  "cnpj": "10436619000105",
  "razao_social": "SUA EMPRESA MODAS LTDA",
  "plan": "pro",
  "aceite_termos": true,
  "aceite_privacidade": true
}
```

**Respostas:**
* `200 OK`: `{"message": "Cadastro realizado com sucesso!"}`
* `400 Bad Request`: `{"error": "É obrigatório aceitar os Termos de Uso."}`

---

### `POST /api/auth/login`
Autentica o usuário e retorna o token de acesso JWT e o refresh token.

**Headers:**
`Content-Type: application/json`

**Corpo da Requisição (JSON):**
```json
{
  "email": "financeiro@suaempresa.com.br",
  "password": "senhaForte123*"
}
```

**Respostas:**
* `200 OK`:
```json
{
  "message": "Login efetuado com sucesso!",
  "token": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "v1.MRq3_...",
  "expiresAt": 1788800000
}
```
* `401 Unauthorized`: `{"error": "E-mail ou senha incorretos."}`

---

### `POST /api/auth/refresh`
Renova a sessão de autenticação de forma silenciosa antes ou após a expiração do token de 1 hora.

**Headers:**
`Content-Type: application/json`

**Corpo da Requisição (JSON):**
```json
{
  "refreshToken": "v1.MRq3_..."
}
```

**Respostas:**
* `200 OK`:
```json
{
  "message": "Sessão renovada com sucesso!",
  "token": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "v1.novo_token_...",
  "expiresAt": 1788803600
}
```
* `401 Unauthorized`: `{"error": "Sessão expirada. Faça login novamente."}`

---

### `GET /api/auth/me`
Retorna as informações do usuário logado e os dados da sua empresa (tenant).

**Headers:**
`Authorization: Bearer <token>`

**Respostas:**
* `200 OK`:
```json
{
  "user": {
    "id": "c8b417e2-...",
    "email": "financeiro@suaempresa.com.br",
    "name": "Roberto da Silva"
  },
  "profile": {
    "is_admin": false,
    "name": "Roberto da Silva",
    "email": "financeiro@suaempresa.com.br"
  },
  "tenant": {
    "id": "e9a22830-...",
    "razao_social": "SUA EMPRESA MODAS LTDA",
    "cnpj": "10436619000105",
    "plan": "pro",
    "subscription_status": "ativo",
    "monthly_quota": 500,
    "used_this_month": 18,
    "pfx_filename": "certificado_2026.pfx",
    "environment": "homologacao"
  }
}
```

---

## 2. Gestão de Empresa e Certificado A1

### `POST /api/tenant/settings`
Atualiza os dados cadastrais da empresa e a conta corrente do Itaú para a remessa SISPAG 240.

**Headers:**
`Authorization: Bearer <token>`
`Content-Type: application/json`

**Corpo da Requisição (JSON):**
```json
{
  "razao_social": "SUA EMPRESA MODAS LTDA",
  "cnpj": "10436619000105",
  "bank_agency": "0334",
  "bank_account": "98775",
  "bank_dac": "7",
  "environment": "producao"
}
```

**Respostas:**
* `200 OK`: `{"message": "Configurações atualizadas com sucesso!"}`
* `400 Bad Request`: `{"error": "CNPJ deve conter 14 dígitos numéricos"}`

---

### `POST /api/tenant/upload-pfx`
Faz o upload do Certificado Digital A1 (.pfx / .p12). A senha é criptografada com AES-256 e o arquivo é salvo no storage isolado do tenant.

**Headers:**
`Authorization: Bearer <token>`
`Content-Type: multipart/form-data`

**Campos:**
* `pfx`: Arquivo binário `.pfx` ou `.p12` (máximo 10 MB).
* `passphrase`: Senha do certificado digital.

**Respostas:**
* `200 OK`: `{"message": "Certificado digital salvo com sucesso!", "filename": "certificado.pfx"}`

---

## 3. Lotes e Emissão de Guias GNRE

### `POST /api/batch/process`
Envia um pacote de XMLs de NF-e para validação tributária, cálculo de DIFAL/FCP e geração das guias GNRE.

**Headers:**
`Authorization: Bearer <token>`
`Content-Type: multipart/form-data`

**Campos:**
* `xmls`: Arquivos XML individuais ou arquivo `.zip` contendo os XMLs das notas fiscais.

**Respostas:**
* `200 OK`:
```json
{
  "batch_id": "8f3e2b10-...",
  "status": "sucesso",
  "total_notas": 18,
  "guias_emitidas": 18,
  "download_remessa_url": "/download/remessa.txt",
  "download_zip_url": "/api/batches/8f3e2b10-.../download-zip"
}
```

---

### `GET /download/remessa.txt`
Faz o download direto do arquivo de remessa Itaú SISPAG CNAB 240 gerado para o lote mais recente do tenant.

**Headers:**
`Authorization: Bearer <token>`

**Respostas:**
* `200 OK`: Arquivo de texto puro (`Content-Type: text/plain; charset=utf-8`) com `Content-Disposition: attachment; filename="remessa.txt"`.

---

## 4. Assinaturas e Cobrança Stripe

### `POST /api/stripe/create-checkout-session`
Inicia uma sessão de checkout oficial no Stripe para contratar ou migrar de plano.

**Headers:**
`Authorization: Bearer <token>`
`Content-Type: application/json`

**Corpo da Requisição (JSON):**
```json
{
  "plan": "pro"
}
```
*Opções de plano:* `starter`, `pro`, `advanced`.

**Respostas:**
* `200 OK`:
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_..."
}
```

---

### `POST /api/stripe/create-portal-session`
Cria uma sessão no Stripe Customer Portal para que o cliente possa alterar o cartão, trocar de plano ou cancelar a assinatura sem intervenção de atendente.

**Headers:**
`Authorization: Bearer <token>`

**Respostas:**
* `200 OK`:
```json
{
  "url": "https://billing.stripe.com/p/session/test_..."
}
```

---

### `GET /api/stripe/subscription`
Consulta o status atual da assinatura do tenant e suas últimas faturas.

**Headers:**
`Authorization: Bearer <token>`

**Respostas:**
* `200 OK`:
```json
{
  "tenant": {
    "plan": "pro",
    "subscription_status": "ativo",
    "monthly_quota": 500,
    "used_this_month": 18,
    "stripe_customer_id": "cus_R9..."
  },
  "subscription": {
    "stripe_subscription_id": "sub_1Q...",
    "status": "active",
    "current_period_end": "2026-10-07T00:00:00Z"
  },
  "invoices": [
    {
      "stripe_invoice_id": "in_1Q...",
      "valor": 399.00,
      "status": "paid",
      "pago_em": "2026-09-07T12:00:00Z",
      "pdf_url": "https://pay.stripe.com/invoice/..."
    }
  ]
}
```

---

## 5. Monitoramento e Health Check

### `GET /api/health`
Retorna as métricas de disponibilidade do sistema em formato JSON para ferramentas automatizadas como **UptimeRobot**, **BetterStack** e orquestradores de containers.

**Respostas:**
* `200 OK` (Operacional):
```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "timestamp": "2026-09-07T16:00:00.000Z",
  "database": {
    "status": "connected",
    "latency_ms": 142
  },
  "environment": "production",
  "version": "2.1.0",
  "response_time_ms": 145
}
```
* `503 Service Unavailable` (Degradação):
```json
{
  "status": "degraded",
  "database": {
    "status": "unreachable"
  }
}
```

> **Dica Visual:** Se você abrir `/health` diretamente pelo navegador Google Chrome ou Edge, o servidor detectará a navegação humana e apresentará um **Dashboard Visual de Status** com indicadores em tempo real.
