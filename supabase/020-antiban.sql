-- Camada anti-ban (humanização dos envios do robô) por empresa.
-- jsonb único e editável: jitter gaussiano, digitação proporcional, ritmo
-- circadiano e pausa anti-rajada. Nulo = usa os padrões seguros do código
-- (normalizeAntiban). Idempotente.
alter table settings add column if not exists antiban jsonb;
