-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Config do Assistente de Leads (editável na tela)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  Guarda a configuração do assistente (nome, instruções/system prompt,
--  contexto, modelo, temperatura, quebra-gelos) por empresa — pra editar na
--  tela, igual configurar um GPT no ChatGPT. Fica em jsonb.
-- ─────────────────────────────────────────────────────────────

alter table settings add column if not exists assistant_config jsonb;

-- Conferir:
-- select column_name from information_schema.columns
-- where table_name='settings' and column_name='assistant_config';
