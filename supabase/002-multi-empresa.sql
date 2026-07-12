-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Fase 1+2: Multi-empresa (contas, convites, isolamento)
--  Cole tudo isto no Supabase: SQL Editor > New query > Run.
--  É SEGURO rodar mais de uma vez (idempotente). Não apaga dados.
--
--  Ideia: sua clínica atual vira a "Empresa #1". Toda tabela ganha um
--  company_id que JÁ VEM preenchido com a Empresa #1 por padrão — então o
--  conector e o painel continuam funcionando sem mexer em nada.
-- ─────────────────────────────────────────────────────────────

-- Id fixo da primeira empresa (sua clínica). Usado como padrão em tudo.
--   00000000-0000-0000-0000-000000000001

-- ── 1) EMPRESAS (tenants) ────────────────────────────────────
create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- Cria a Empresa #1 (sua clínica) se ainda não existir.
insert into companies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Centro Médico da Família')
on conflict (id) do nothing;

-- ── 2) MEMBROS (liga usuário do Auth a uma empresa) ──────────
-- role: owner (dono) | admin | member.  perms: null = acesso total na empresa.
create table if not exists company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null,                 -- id do usuário no Supabase Auth
  email       text not null,
  role        text not null default 'member',
  perms       jsonb,                         -- permissões dentro da empresa (null = tudo)
  name        text,                          -- nome de exibição
  phone       text,                          -- telefone (perfil)
  avatar_url  text,                          -- foto (perfil)
  created_at  timestamptz default now(),
  unique (company_id, user_id)
);
create index if not exists idx_members_user on company_members(user_id);
create index if not exists idx_members_email on company_members(lower(email));

-- Liga TODOS os usuários que já existem à Empresa #1.
-- Quem não tem perms no metadata é tratado como dono (owner); o resto, member.
insert into company_members (company_id, user_id, email, role, perms, name)
select
  '00000000-0000-0000-0000-000000000001',
  u.id,
  u.email,
  case when u.raw_user_meta_data ? 'perms' then 'member' else 'owner' end,
  u.raw_user_meta_data->'perms',
  nullif(u.raw_user_meta_data->>'name', '')
from auth.users u
on conflict (company_id, user_id) do nothing;

-- ── 3) CONVITES (admin convida por e-mail) ───────────────────
-- Fluxo BotConversa: a pessoa se cadastra, mas só entra na empresa depois que
-- o admin a convida pelo e-mail. status: pending | accepted | revoked.
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  email       text not null,
  role        text not null default 'member',
  perms       jsonb,
  status      text not null default 'pending',
  invited_by  text,
  created_at  timestamptz default now()
);
create index if not exists idx_invites_email on invites(lower(email)) where status = 'pending';

-- ── 4) company_id em TODAS as tabelas de dados ───────────────
-- DEFAULT = Empresa #1: linhas novas (do conector) já entram na clínica sem
-- precisar mudar o conector. Depois (multi-WhatsApp) tiramos o default.
do $$
declare t text;
begin
  foreach t in array array['contacts','messages','flows','flow_sessions','outbox','quick_replies']
  loop
    execute format(
      'alter table %I add column if not exists company_id uuid references companies(id) default ''00000000-0000-0000-0000-000000000001''',
      t);
    execute format(
      'update %I set company_id = ''00000000-0000-0000-0000-000000000001'' where company_id is null',
      t);
    execute format('create index if not exists idx_%s_company on %I(company_id)', t, t);
  end loop;
end $$;

-- ── 5) SETTINGS por empresa (antes era linha única id=1) ─────
alter table settings drop constraint if exists settings_singleton;
alter table settings add column if not exists company_id uuid references companies(id);
update settings set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
create unique index if not exists idx_settings_company on settings(company_id);
-- Permite várias linhas de settings (uma por empresa): id passa a usar sequência.
create sequence if not exists settings_id_seq owned by settings.id;
alter table settings alter column id set default nextval('settings_id_seq');
select setval('settings_id_seq', greatest(1, (select coalesce(max(id),1) from settings)));

-- ── 6) VIEW de conversas com company_id (pra filtrar por empresa) ──
-- company_id vai POR ÚLTIMO (create-or-replace só deixa ADICIONAR no fim).
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
  c.company_id
from contacts c
left join lateral (
  select text, from_me, sent_at
  from messages
  where contact_id = c.id
  order by sent_at desc nulls last
  limit 1
) m on true;

-- ── Pronto. Confira: ─────────────────────────────────────────
--   select name from companies;
--   select email, role from company_members;
