-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Observação (nota) no contato
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
-- ─────────────────────────────────────────────────────────────

alter table contacts add column if not exists note text;
