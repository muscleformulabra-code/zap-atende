-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Mídia nas mensagens (imagem/áudio/vídeo/documento)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
-- ─────────────────────────────────────────────────────────────

alter table messages add column if not exists media_url text;
alter table messages add column if not exists media_type text; -- image|audio|video|document
