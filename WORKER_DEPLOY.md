# 🚂 Deploy do Worker em Servidor Persistente (Railway)

## Por que separar o Worker?

A Vercel executa **funções serverless** — sem estado, com timeout de 60s.
O `pg-boss` precisa de um processo Node.js **continuamente rodando** para escutar a fila.

**Solução:** API na Vercel + Worker no Railway (processo persistente dedicado).

---

## Passo a Passo — Railway.app

### 1. Criar conta e novo projeto

1. Acesse [railway.app](https://railway.app) e faça login com o GitHub
2. Clique em **New Project → Deploy from GitHub Repo**
3. Selecione o repositório `aliados-apex`

### 2. Configurar variáveis de ambiente no Railway

No painel do Railway → **Variables**, adicione:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://sua-url.supabase.co
SUPABASE_KEY=sua-service-role-key
ENCRYPTION_KEY=seu-encryption-key-32chars
NODE_ENV=production
```

> ⚠️ Use o **Session Pooler** do Supabase na porta **5432** (não o Transaction Pooler 6543).

### 3. Criar railway.toml na raiz do projeto

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node worker/index.js"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

### 4. Ativar "Always On" no plano Hobby ($5/mês)

No Railway → **Settings → Scaling → Always On: ON**.

### 5. Verificar nos logs

```
✅ pg-boss iniciado. Worker escutando fila 'gnre-batch'...
```

---

## Arquitetura Final

```
Cliente → Vercel (API + Frontend)
              ↓ insere job na fila pg-boss (PostgreSQL)
              ↓
          Railway (Worker Node.js persistente)
              ↓ processa GNRE / CNAB
              ↓ salva guias no Supabase Storage
```
