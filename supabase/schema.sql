-- ─────────────────────────────────────────────────────────────
--  ZAP ATENDE — Banco de dados (Fase 1)
--  Cole tudo isto no Supabase: painel > SQL Editor > New query > Run
-- ─────────────────────────────────────────────────────────────

-- CONTATOS: todo mundo que fala com a clínica cai aqui automaticamente.
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  jid         text unique not null,          -- id do WhatsApp (ex: 556199999999@s.whatsapp.net)
  phone       text,                          -- número
  name        text,                          -- nome que a pessoa usa no WhatsApp
  tags        text[] default '{}',           -- etiquetas (ex: {psiquiatria,lead-frio})
  created_at  timestamptz default now()      -- quando entrou em contato pela 1ª vez
);
alter table contacts add column if not exists tags text[] default '{}';
create index if not exists idx_contacts_tags on contacts using gin (tags);
alter table contacts add column if not exists avatar_url text;            -- foto de perfil do WhatsApp (quando a privacidade permite)
alter table contacts add column if not exists avatar_updated_at timestamptz;

-- MENSAGENS: histórico de cada conversa.
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid references contacts(id) on delete cascade,
  jid           text not null,
  from_me       boolean not null default false, -- true = fomos nós; false = foi o paciente
  text          text,                           -- conteúdo (ou rótulo tipo [imagem])
  wa_message_id text,                            -- id da mensagem no WhatsApp (evita duplicar)
  sent_at       timestamptz,                     -- quando a mensagem foi enviada
  sent_by       text,                            -- e-mail do atendente que enviou (null = bot/paciente)
  created_at    timestamptz default now()
);
alter table messages add column if not exists sent_by text;

create unique index if not exists idx_messages_wa_id on messages(wa_message_id) where wa_message_id is not null;
create index if not exists idx_messages_contact on messages(contact_id);
create index if not exists idx_messages_sent_at on messages(sent_at desc);

-- VIEW de conversas: para cada contato, a última mensagem.
-- last_from_me = false  ->  o paciente foi o último a falar (AGUARDANDO RESPOSTA).
-- avatar_url vai POR ÚLTIMO: create-or-replace só permite ADICIONAR colunas no
-- fim (não reordenar/inserir no meio de uma view já existente).
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
  c.avatar_url
from contacts c
left join lateral (
  select text, from_me, sent_at
  from messages
  where contact_id = c.id
  order by sent_at desc nulls last
  limit 1
) m on true;

-- ─────────────────────────────────────────────────────────────
--  CHATBOT / AUTOMAÇÃO (fluxos)
-- ─────────────────────────────────────────────────────────────

-- FLUXOS: cada fluxo é um "chatbot" (boas-vindas, menu, roteamento...).
-- A definição fica em JSON (o construtor visual edita isso).
create table if not exists flows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default false,   -- qual fluxo responde novos contatos
  definition  jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- SESSÃO: em que ponto do fluxo cada contato está.
-- status: active (bot conduzindo) | handoff (passou pro atendente) | done
create table if not exists flow_sessions (
  contact_id    uuid primary key references contacts(id) on delete cascade,
  flow_id       uuid references flows(id) on delete set null,
  current_node  text,
  status        text not null default 'active',
  updated_at    timestamptz default now()
);

-- CONFIGURAÇÕES (linha única id=1): liga/desliga do robô, horário de
-- atendimento, mensagem fora do horário e delays anti-ban.
create table if not exists settings (
  id                 int primary key default 1,
  bot_enabled        boolean not null default true,
  company_name       text default '',
  hours              jsonb not null default '{"days":[1,2,3,4,5],"start":"08:00","end":"18:00"}'::jsonb,
  off_hours_message  text default 'Olá! 🌙 No momento estamos fora do horário de atendimento. Assim que abrirmos, retornamos sua mensagem. Obrigado!',
  min_delay_ms       int not null default 1200,
  max_delay_ms       int not null default 3500,
  reengage_hours     int not null default 12,   -- paciente que volta após X horas -> reinicia o fluxo
  updated_at         timestamptz default now(),
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;
alter table settings add column if not exists reengage_hours int not null default 12;
-- Fluxos padrões (base): resposta padrão e mídia. O "boas-vindas" é o fluxo is_active.
alter table settings add column if not exists default_flow_id uuid references flows(id) on delete set null;
alter table settings add column if not exists media_flow_id uuid references flows(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
--  OUTBOX: mensagens que o painel (inbox) quer enviar pelo WhatsApp.
--  O conector lê as pendentes e envia.
-- ─────────────────────────────────────────────────────────────
create table if not exists outbox (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references contacts(id) on delete cascade,
  jid         text not null,
  text        text not null,
  status      text not null default 'pending',   -- pending | sent | error
  created_at  timestamptz default now()
);
create index if not exists idx_outbox_pending on outbox(status) where status = 'pending';

-- ─────────────────────────────────────────────────────────────
--  RESPOSTAS RÁPIDAS: mensagens prontas chamadas por /atalho no inbox.
-- ─────────────────────────────────────────────────────────────
create table if not exists quick_replies (
  id          uuid primary key default gen_random_uuid(),
  shortcut    text not null,   -- ex: "prontuario"  → usado como /prontuario
  text        text not null,
  created_at  timestamptz default now()
);
