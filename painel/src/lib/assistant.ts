// ─────────────────────────────────────────────────────────────
//  ASSISTENTE DE LEADS — configuração
//  Ferramenta de APOIO ao atendente humano: ele cola a mensagem do paciente e
//  a IA sugere uma resposta pronta pra copiar. NÃO responde o paciente sozinho.
//
//  A configuração (nome, instruções, modelo, etc.) é EDITÁVEL NA TELA
//  (Assistente → ⚙️ Configurar) e guardada por empresa. Os valores abaixo são
//  só os PADRÕES iniciais.
// ─────────────────────────────────────────────────────────────

export type AssistantConfig = {
  name: string
  instructions: string // o "cérebro" — system prompt
  context: string // conhecimento extra (preços, endereço, horários…) — anexado ao prompt
  model: string
  temperature: number
  starters: string[] // quebra-gelos (exemplos que aparecem na tela vazia)
}

// Modelos sugeridos no seletor (é só um datalist — dá pra digitar outro).
export const ASSISTANT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini', 'o3-mini']

// SYSTEM PROMPT padrão (o usuário pode reescrever tudo pela tela).
export const SYSTEM_PROMPT = `Você é o assistente da Central de Leads da clínica (Centro Médico da Família / Ricco Odontologia), em Taguatinga-DF. Sua função é AJUDAR O ATENDENTE HUMANO: a partir da mensagem que o paciente enviou no WhatsApp, você escreve uma resposta pronta, no tom da clínica, para o atendente copiar e colar.

DIRETRIZES:
- Tom acolhedor, humano e profissional. Trate o paciente por "você". No máximo 1 ou 2 emojis.
- Objetivo principal: encaminhar para o AGENDAMENTO (avaliação). Peça nome completo, o procedimento/especialidade e uma preferência de dia/horário.
- Frases curtas e claras. Português do Brasil. Nunca use travessão (—); use vírgula, ponto ou dois-pontos.
- Preço: evite cravar valores exatos (variam); explique que depende de avaliação e ofereça o agendamento.
- Nunca invente valores, convênios, horários ou informação clínica. Se não souber, diga que vai confirmar e siga com o agendamento.
- Não dê diagnóstico. Em urgência, oriente procurar atendimento imediato.

FORMATO: devolva APENAS o texto pronto pra enviar ao paciente (sem aspas, sem "resposta sugerida:", sem explicações).`

// Configuração PADRÃO (usada quando a empresa ainda não configurou).
export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  name: 'Assistente de Leads',
  instructions: SYSTEM_PROMPT,
  context: '',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  starters: [
    'Oi, quanto custa uma limpeza?',
    'Vocês aceitam convênio?',
    'Quero avaliar meu sorriso',
    'Estou com dor de dente, o que faço?',
  ],
}

// Monta o system prompt final (instruções + contexto extra, se houver).
export function buildSystemPrompt(c: AssistantConfig): string {
  const ctx = (c.context || '').trim()
  return ctx ? `${c.instructions}\n\n─── CONTEXTO DA CLÍNICA (use como base) ───\n${ctx}` : c.instructions
}

// Normaliza um objeto vindo do banco (preenche defaults).
export function normalizeAssistantConfig(raw?: Partial<AssistantConfig> | null): AssistantConfig {
  const d = DEFAULT_ASSISTANT_CONFIG
  return {
    name: (raw?.name ?? d.name) || d.name,
    instructions: (raw?.instructions ?? d.instructions) || d.instructions,
    context: raw?.context ?? d.context,
    model: (raw?.model ?? d.model) || d.model,
    temperature: typeof raw?.temperature === 'number' ? raw.temperature : d.temperature,
    starters: Array.isArray(raw?.starters) ? raw!.starters!.filter((s) => s && s.trim()) : d.starters,
  }
}
