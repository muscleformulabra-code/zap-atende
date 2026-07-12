-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Vários Assistentes de IA por empresa
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  Cada empresa pode ter VÁRIOS assistentes (ex.: Ricco Odontologia, Slim
--  Station, Clínica Popular…), cada um com seu nome, descrição, instruções,
--  contexto, modelo, quebra-gelos e CONHECIMENTO (texto extraído de arquivos).
-- ─────────────────────────────────────────────────────────────

create table if not exists assistants (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade
                 default '00000000-0000-0000-0000-000000000001',
  name         text not null default 'Novo assistente',
  description  text,
  instructions text,
  context      text,
  model        text default 'gpt-4o-mini',
  temperature  real default 0.4,
  starters     jsonb default '[]'::jsonb,       -- quebra-gelos (lista de textos)
  knowledge    text,                             -- texto extraído dos arquivos
  files        jsonb default '[]'::jsonb,        -- [{name, url, chars}]
  created_at   timestamptz default now()
);
create index if not exists idx_assistants_company on assistants(company_id);

-- RLS (só o servidor acessa, igual as outras).
alter table assistants enable row level security;
alter table assistants force row level security;

-- Conferir:
select name from assistants;
