// ─────────────────────────────────────────────────────────────
//  CAMADA ANTI-BAN (humanização dos envios do robô)
//  Config por EMPRESA, com defaults SEGUROS. Qualquer empresa nova já nasce
//  protegida (normalizeAntiban(null) devolve os padrões). O conector recebe
//  este objeto via /api/settings e aplica a matemática do atraso/digitação.
//
//  Só afeta os envios AUTOMÁTICos (robô/IA/fluxo). Mensagem digitada por um
//  atendente humano no inbox NÃO passa por aqui.
// ─────────────────────────────────────────────────────────────

export type Antiban = {
  gaussianJitter: boolean // atraso concentrado no meio (curva de sino), mais humano que aleatório puro
  typingRealism: boolean  // tempo de "digitando…" proporcional ao tamanho da resposta
  typingWpm: number       // velocidade de digitação simulada (palavras por minuto)
  typingMaxMs: number     // teto do tempo de digitação (respostas longas não travam)
  circadian: boolean      // de madrugada responde mais devagar (parece gente dormindo)
  nightFactor: number     // multiplicador do atraso na madrugada (0h–6h de Brasília)
  burstEnabled: boolean   // após muitos envios seguidos, faz uma pausa longa (anti-rajada)
  burstLimit: number      // quantos envios na janela antes de descansar
  burstWindowMs: number   // janela (ms) pra contar os envios
  restMinMs: number       // descanso mínimo (ms)
  restMaxMs: number       // descanso máximo (ms)
}

// Padrões seguros — valem pra QUALQUER empresa que não tenha config própria.
export function defaultAntiban(): Antiban {
  return {
    gaussianJitter: true,
    typingRealism: true,
    typingWpm: 45,
    typingMaxMs: 8000,
    circadian: true,
    nightFactor: 3,
    burstEnabled: true,
    burstLimit: 45,
    burstWindowMs: 10 * 60 * 1000, // 10 min
    restMinMs: 10 * 60 * 1000,     // 10 min
    restMaxMs: 15 * 60 * 1000,     // 15 min
  }
}

// Preenche o que faltar com o padrão (registro salvo antigo continua válido).
export function normalizeAntiban(raw: Partial<Antiban> | null | undefined): Antiban {
  const d = defaultAntiban()
  const r = raw || {}
  const num = (v: unknown, def: number) => (typeof v === 'number' && isFinite(v) ? v : def)
  return {
    gaussianJitter: r.gaussianJitter ?? d.gaussianJitter,
    typingRealism: r.typingRealism ?? d.typingRealism,
    typingWpm: num(r.typingWpm, d.typingWpm),
    typingMaxMs: num(r.typingMaxMs, d.typingMaxMs),
    circadian: r.circadian ?? d.circadian,
    nightFactor: num(r.nightFactor, d.nightFactor),
    burstEnabled: r.burstEnabled ?? d.burstEnabled,
    burstLimit: num(r.burstLimit, d.burstLimit),
    burstWindowMs: num(r.burstWindowMs, d.burstWindowMs),
    restMinMs: num(r.restMinMs, d.restMinMs),
    restMaxMs: num(r.restMaxMs, d.restMaxMs),
  }
}
