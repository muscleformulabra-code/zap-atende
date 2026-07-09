# Deploy — Zap Atende

Arquitetura em produção:

```
Painel (Next.js) ── Vercel        ← site com login/inbox/fluxos/config
Conector (Baileys) ── Railway     ← conexão WhatsApp 24/7 (QR)
Banco + Login ── Supabase         ← já configurado
```

> ⚠️ Migrar do BotConversa: só desligue o BotConversa desse número **depois** de testar tudo aqui. Dois bots no mesmo número respondem em dobro.

---

## 0) Subir o código no GitHub
No terminal, dentro de `zap-atende`:
```bash
git init
git add .
git commit -m "Zap Atende"
# crie um reppositório vazio no GitHub e:
git remote add origin https://github.com/SEU-USUARIO/zap-atende.git
git push -u origin main
```
*(O `.gitignore` já protege `.env`, `auth/` e `node_modules`.)*

## 1) Painel no Vercel
1. vercel.com → **Add New → Project** → importe o repo `zap-atende`.
2. **Root Directory:** `painel`
3. **Environment Variables** (Settings → Environment Variables):
   - `SUPABASE_URL` = https://kmybtiibxuyqjtztchtx.supabase.co
   - `SUPABASE_SERVICE_KEY` = (a service_role key)
   - `SUPABASE_ANON_KEY` = (a anon key)
   - `CONNECTOR_URL` = (preenche no passo 3, com a URL do Railway)
4. **Deploy**. Anote a URL (ex: `https://zap-atende.vercel.app`).

## 2) Conector no Railway
1. railway.app → **New Project → Deploy from GitHub repo** → `zap-atende`.
2. **Root Directory:** `connector`  (Settings → Root Directory)
3. **Variables:**
   - `SUPABASE_URL` = https://kmybtiibxuyqjtztchtx.supabase.co
   - `SUPABASE_SERVICE_KEY` = (service_role key)
   - `PAINEL_URL` = (URL do Vercel do passo 1)
4. **Volume** (pra não perder a sessão do WhatsApp): Add Volume, **Mount path:** `/app/auth`
5. **Networking → Generate Domain** (pra ter uma URL pública). Anote (ex: `https://zap-conector.up.railway.app`).

## 3) Ligar os dois
- No **Vercel**: coloque `CONNECTOR_URL` = a URL pública do Railway (passo 2.5) → **Redeploy**.
- Pronto: painel (Vercel) fala com o conector (Railway).

## 4) Conectar o WhatsApp
- Abra no navegador: `https://SUA-URL-RAILWAY/qr`
- Escaneie com o WhatsApp do número (Aparelhos conectados → Conectar aparelho).
- Feito: o bot começa a responder. A sessão fica salva no volume (não precisa reescanear).

## 5) Acessos da equipe
- Login inicial: **admin@zapatende.com** / **zap123456** → **troque a senha** e cadastre os atendentes em **/equipe**.

---

## Checklist de "apto a receber"
- [ ] Código no GitHub
- [ ] Painel no Vercel (env vars ok)
- [ ] Conector no Railway (volume em /app/auth, domínio gerado)
- [ ] CONNECTOR_URL e PAINEL_URL cruzados
- [ ] QR escaneado (número conectado)
- [ ] Atendentes cadastrados em /equipe
- [ ] BotConversa desligado desse número (só na hora de migrar)
