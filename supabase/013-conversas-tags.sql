-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Etiquetas na view de conversas (pros filtros do inbox)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--  tags vai POR ÚLTIMO (create-or-replace só deixa ADICIONAR no fim).
-- ─────────────────────────────────────────────────────────────

create or replace view conversations as
select
  c.id         as contact_id,
  c.jid,
  c.phone,
  c.name,
  c.created_at,
  m.text       as last_text,
  m.from_me    as last_from_me,
  m.sent_at    as last_sent_at,
  c.avatar_url,
  c.company_id,
  c.tags
from contacts c
left join lateral (
  select text, from_me, sent_at
  from messages
  where contact_id = c.id
  order by sent_at desc nulls last
  limit 1
) m on true;
