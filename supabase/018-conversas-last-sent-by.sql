-- Expõe QUEM mandou a última mensagem (sent_by) na view de conversas.
-- Usado no Pendências pra distinguir: última msg do BOT/IA (sent_by null →
-- precisa de humano) vs de um ATENDENTE (sent_by = e-mail → já tratado).
-- create-or-replace: a coluna nova vai POR ÚLTIMO. SEGURO e idempotente.
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
  c.tags,
  m.sent_by    as last_sent_by
from contacts c
left join lateral (
  select text, from_me, sent_at, sent_by
  from messages
  where contact_id = c.id
  order by sent_at desc nulls last
  limit 1
) m on true;
