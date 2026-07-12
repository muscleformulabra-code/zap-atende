-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Catálogo de ETIQUETAS (com cor e descrição)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  Antes as etiquetas eram só texto solto em contacts.tags. Agora existe um
--  catálogo (nome + descrição + cor) por empresa — igual o BotConversa. Os
--  contatos continuam guardando as etiquetas aplicadas em contacts.tags (por
--  nome); este catálogo define as etiquetas disponíveis.
-- ─────────────────────────────────────────────────────────────

create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade
                default '00000000-0000-0000-0000-000000000001',
  name        text not null,
  description text,
  color       text not null default 'gray',   -- gray|green|red|yellow|blue|violet|pink|teal
  created_at  timestamptz default now(),
  unique (company_id, name)
);
create index if not exists idx_tags_company on tags(company_id);

-- Semeia o catálogo com as etiquetas que já estão em uso nos contatos da
-- Empresa #1 (pra não começar vazio).
insert into tags (company_id, name)
select distinct c.company_id, t
from contacts c, unnest(c.tags) as t
where t is not null and t <> ''
on conflict (company_id, name) do nothing;

-- RLS (mesma trava das outras tabelas).
alter table tags enable row level security;
alter table tags force row level security;

-- Conferir:
select name, color from tags order by name limit 20;
