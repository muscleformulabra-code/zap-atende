# Zap Atende

Plataforma própria de atendimento por WhatsApp (estilo BotConversa) — inbox multi-atendente + métricas.
Conexão via **QR code** (Baileys). Construído em fases.

## Onde estamos: **Fase 1 — Fundação** ✅ (montada, aguardando testar)

Meta: conectar o WhatsApp e salvar **todo contato e mensagem** automaticamente no banco.

```
WhatsApp (chip do bot) ──QR──► connector (Baileys) ──► Supabase (banco)
```

## Como testar a Fase 1 (local, custo R$0)

### 1. Criar as tabelas no Supabase
- Entre no seu projeto no Supabase → **SQL Editor** → **New query**.
- Cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.

### 2. Configurar as credenciais
```bash
cd connector
cp .env.example .env
```
- No Supabase: **Project Settings → API**. Copie:
  - **Project URL** → `SUPABASE_URL`
  - chave **service_role** (secreta) → `SUPABASE_SERVICE_KEY`
- Cole no arquivo `connector/.env`.

### 3. Instalar e rodar
```bash
cd connector
npm install
npm start
```
- Vai aparecer um **QR code** no terminal.
- No celular do **chip do bot**: WhatsApp → **Aparelhos conectados** → **Conectar aparelho** → escaneie.
- Mande uma mensagem de qualquer outro número para o bot.
- Veja o contato e a mensagem aparecerem no Supabase (**Table Editor → contacts / messages**).

> Dica: use um **chip dedicado** ao bot, nunca seu WhatsApp pessoal (risco de bloqueio pela Meta).

## Próximas fases (roadmap)
2. Inbox multi-atendente (responder, atribuir, enviar arquivo)
3. **Métricas** (sem resposta, leads do dia, ranking de atendentes, tempo médio)
4. Equipe / login
5. Fluxos arrasta-e-solta
6. Campanhas rastreáveis
