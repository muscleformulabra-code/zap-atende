-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Segurança: RLS (Row Level Security) em tudo
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO (não muda o app).
--
--  O QUE FAZ: liga RLS em todas as tabelas SEM criar políticas de acesso =
--  "default-deny". Resultado: a API pública do banco (chave anon / usuário)
--  NÃO consegue ler nem escrever nada. Só o SERVIDOR (service_role, que o
--  painel e o conector usam) enxerga os dados — e ele passa por cima do RLS.
--
--  Efeito no app: ZERO (o servidor usa a service_role). Ganho: se a chave
--  pública vazar um dia, as tabelas continuam seladas. É a linha de base de
--  segurança que a própria Supabase recomenda.
-- ─────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_members','invites',
    'contacts','messages','flows','flow_sessions',
    'settings','outbox','quick_replies'
  ]
  loop
    if to_regclass(t) is null then continue; end if;              -- pula tabela ausente
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t); -- vale até pro dono da tabela
  end loop;
end $$;

-- A VIEW conversations herda o acesso das tabelas de baixo (contacts/messages),
-- então já fica protegida pelo RLS delas — não precisa de nada extra.

-- Conferir (deve listar as tabelas com rowsecurity = true):
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--   order by tablename;
