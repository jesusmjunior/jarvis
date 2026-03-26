# JARVIS 360° — Checklist de Deploy Completo

## Admins Autorizados:
- admjesusia@gmail.com
- jesumjunior2021@gmail.com
- martjesusmartins@gmail.com
## Supabase: https://mdhmbnlijiwgrdecrfeo.supabase.co

---

## PARTE 1 — O que está PRONTO (não precisa alterar)

- [x] `src/utils/supabase.ts` — URL e publishable key já configuradas
- [x] `.env.local` — Supabase configurado para localhost
- [x] `.env.production` — Supabase configurado para deploy
- [x] Schema PostgreSQL — Tabelas criadas no Supabase
- [x] RLS policies — isolamento por user_id ativo
- [x] Admin bloqueado — lista de administradores autorizados ativa

---

## PARTE 2 — O que você ainda precisa preencher

### 2A — Google Cloud Console
Acesse: https://console.cloud.google.com

1. Abrir seu projeto → APIs → Credenciais → OAuth 2.0 Client ID
2. Copiar o `Client ID` e `Client Secret`
3. Adicionar nas URIs autorizadas:
   - `http://localhost:3000`
   - `https://ais-dev-cp4nkpyqibutq3mrtocx7e-93698198079.us-west2.run.app`
4. Adicionar nos redirects autorizados:
   - `http://localhost:3000/auth/callback`
   - `https://ais-dev-cp4nkpyqibutq3mrtocx7e-93698198079.us-west2.run.app/auth/callback`
   - `https://ais-pre-cp4nkpyqibutq3mrtocx7e-93698198079.us-west2.run.app/auth/callback`

### 2B — Preencher nos arquivos .env
Substituir os valores `SEU_*` em `.env.local` e `.env.production`:

```
VITE_OAUTH_CLIENT_ID        → Client ID do passo 2A
VITE_GEMINI_API_KEY         → https://aistudio.google.com/app/apikey
```

### 2C — Preencher no server.env
```
DATABASE_URL                → Substituir [YOUR-PASSWORD] pela senha Supabase
SUPABASE_SERVICE_ROLE_KEY   → Supabase Dashboard → Settings → API → service_role
OAUTH_CLIENT_SECRET         → Google Cloud Console → Credenciais
SESSION_SECRET              → Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## PARTE 3 — Comandos de instalação e deploy

### Rodar localmente:
```bash
npm install
npm run dev
```

### Deploy:
O deploy é feito automaticamente através da plataforma.

---

## PARTE 4 — Verificação pós-deploy

| Teste | URL | Resultado esperado |
|-------|-----|--------------------|
| Frontend carrega | https://ais-dev-ij7uicahso7wrzmr4uf2jx-3327892073.us-west2.run.app | Tela JARVIS 360° |
| Auth Google | Clicar em "Conectar" | Popup Google abre |
| Login admin | Lista autorizada | Acesso liberado |
| Supabase | Dashboard → Table Editor | Dados aparecendo |

---

## PARTE 5 — Arquivos que NÃO devem ir para o repositório

Adicione ao `.gitignore`:
```
.env
.env.local
.env.production
server.env
*.key
```
