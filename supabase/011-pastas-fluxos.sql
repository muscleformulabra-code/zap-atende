-- ─────────────────────────────────────────────────────────────
--  RICCO CHAT — Pastas de fluxos (organizar os fluxos)
--  Cole no Supabase: SQL Editor > New query > Run. SEGURO e idempotente.
-- ─────────────────────────────────────────────────────────────

create table if not exists flow_folders (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade
                default '00000000-0000-0000-0000-000000000001',
  name        text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_flow_folders_company on flow_folders(company_id);
alter table flow_folders enable row level security;
alter table flow_folders force row level security;

-- Cada fluxo pode estar dentro de uma pasta (null = raiz).
alter table flows add column if not exists folder_id uuid references flow_folders(id) on delete set null;
