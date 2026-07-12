-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Integrações: chave da OpenAI (por empresa)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  A chave fica só no banco (protegida pelo RLS — só o servidor acessa) e
--  NUNCA é devolvida ao navegador. Usada pelo Assistente de Leads.
-- ─────────────────────────────────────────────────────────────

alter table settings add column if not exists openai_key text;

-- Conferir (deve mostrar a coluna):
-- select column_name from information_schema.columns
-- where table_name='settings' and column_name='openai_key';
