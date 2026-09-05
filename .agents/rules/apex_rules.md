# REGRAS DO PROJETO APEX GNRE

## Contexto Fixo
- **Stack**: Node.js/Express, Supabase, Vercel (API) + Render (Worker)
- **Serviços Críticos**:
  - `services/parser_service.js` (lê XML NF-e)
  - `services/gnre_service.js` (mTLS + Proxy + Portal Nacional)
  - `services/dua_es_service.js` (SEFAZ-ES)
  - `services/cnab_service.js` (Itaú 240 / SISPAG)
- **Segurança**: PFX criptografado com AES-256-CBC via `ENCRYPTION_KEY`. NUNCA logar senha.
- **Banco**: `tenants`, `profiles`, `batches`, `guides`. `tenant_id` é a chave de tudo.

## Regras de Ouro (Invioláveis)
1. `.env`, `CERTIFICADOS/`, `xml_nfe/`, `node_modules/` NUNCA vão pro git.
2. A lógica de `HttpsProxyAgent` para SEFAZ é intocável, ela evita bloqueio de IP na Vercel.
3. `server.js` com 1500 linhas precisa morrer. Separe em API (leve) + Worker (pesado).
4. Todo SELECT precisa de RLS. Sem RLS, não é SaaS.
