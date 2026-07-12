-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Fase 3: Multi-WhatsApp (um número por empresa)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
--
--  O conector agora salva contatos por EMPRESA (company_id, jid). Este índice
--  permite isso. Ele CONVIVE com o índice único antigo (jid global) — nada
--  quebra. O deploy do conector deve ser feito logo depois desta migração.
-- ─────────────────────────────────────────────────────────────

-- Contato único POR EMPRESA (o mesmo número pode ser paciente de empresas
-- diferentes). Necessário pro upsert on_conflict=company_id,jid do conector.
create unique index if not exists idx_contacts_company_jid on contacts (company_id, jid);

-- ⚠️ QUANDO for conectar o WhatsApp de uma 2ª empresa que compartilhe algum
-- número com a 1ª, rode TAMBÉM a linha abaixo pra liberar o mesmo número em
-- empresas diferentes (só depois do conector novo no ar):
--   alter table contacts drop constraint if exists contacts_jid_key;
