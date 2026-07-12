-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Campanhas (tráfego pago: frase do anúncio → fluxo certo)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  Quando o paciente clica no link do anúncio, o WhatsApp já vem com a FRASE
--  da campanha. Ao enviar, o bot dispara o FLUXO específico da campanha (pula o
--  menu de boas-vindas), indo direto ao ponto.
-- ─────────────────────────────────────────────────────────────

create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade
                 default '00000000-0000-0000-0000-000000000001',
  name         text not null,
  flow_id      uuid references flows(id) on delete set null,
  phrase       text not null,               -- frase que dispara (ex.: "olá quero testar")
  participants int default 0,               -- quantos leads entraram por essa campanha
  executions   int default 0,
  created_at   timestamptz default now()
);
create index if not exists idx_campaigns_company on campaigns(company_id);
alter table campaigns enable row level security;
alter table campaigns force row level security;

-- Incremento atômico (o conector chama quando a frase dispara).
create or replace function increment_campaign_metric(p_id uuid, p_part int, p_exec int)
returns void language sql as $$
  update campaigns
     set participants = coalesce(participants,0) + p_part,
         executions   = coalesce(executions,0)   + p_exec
   where id = p_id;
$$;
