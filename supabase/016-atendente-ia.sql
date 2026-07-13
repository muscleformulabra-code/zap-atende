-- Atendente IA (Sofia) — config estruturada e editável por empresa.
-- Um único JSON por empresa: persona, clínica, horários, profissionais,
-- serviços, FAQ, política de preço e regras de handoff.
alter table settings add column if not exists ai_attendant jsonb;
