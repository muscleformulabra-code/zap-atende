-- Marca um contato como EQUIPE (profissional/colega interno), pra separar dos
-- leads/pacientes no inbox. create-or-replace: coluna nova vai POR ÚLTIMO.
alter table contacts add column if not exists is_team boolean not null default false;

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
  m.sent_by    as last_sent_by,
  c.is_team
from contacts c
left join lateral (
  select text, from_me, sent_at, sent_by
  from messages
  where contact_id = c.id
  order by sent_at desc nulls last
  limit 1
) m on true;
