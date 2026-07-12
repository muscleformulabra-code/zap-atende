-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Métricas de fluxos (Execuções, Connections, CTR)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  executions  = quantas vezes o fluxo foi INICIADO (o paciente entrou nele)
--  connections = respostas/cliques válidos DENTRO do fluxo (engajamento)
--  CTR%        = connections / executions (calculado na tela)
-- ─────────────────────────────────────────────────────────────

alter table flows add column if not exists executions int default 0;
alter table flows add column if not exists connections int default 0;

-- Incremento ATÔMICO (evita corrida de leitura/escrita).
create or replace function increment_flow_metric(p_flow_id uuid, p_exec int, p_conn int)
returns void language sql as $$
  update flows
     set executions  = coalesce(executions, 0)  + p_exec,
         connections = coalesce(connections, 0) + p_conn
   where id = p_flow_id;
$$;
