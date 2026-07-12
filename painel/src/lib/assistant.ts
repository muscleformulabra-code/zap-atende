// ─────────────────────────────────────────────────────────────
//  ASSISTENTES DE LEADS — tipos e helpers
//  Cada empresa pode ter VÁRIOS assistentes (Ricco Odontologia, Slim Station…),
//  cada um com nome, descrição, instruções, contexto, modelo, quebra-gelos e
//  conhecimento (texto extraído de arquivos). Tudo editável na tela.
// ─────────────────────────────────────────────────────────────

export type AssistantFile = { name: string; url: string; chars: number }

export type Assistant = {
  id: string
  name: string
  description: string
  instructions: string // system prompt (o "cérebro")
  context: string // conhecimento extra digitado
  model: string
  temperature: number
  starters: string[] // quebra-gelos
  knowledge: string // texto extraído dos arquivos (injetado no prompt)
  files: AssistantFile[] // metadados dos arquivos enviados
}

// Modelos sugeridos no seletor (datalist — dá pra digitar outro).
export const ASSISTANT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini', 'o3-mini']

// Instruções padrão (o usuário reescreve pela tela).
export const DEFAULT_INSTRUCTIONS = `Você é o assistente da Central de Leads da clínica, em Taguatinga-DF. Sua função é AJUDAR O ATENDENTE HUMANO: a partir da mensagem que o paciente enviou no WhatsApp, você escreve uma resposta pronta, no tom da clínica, para o atendente copiar e colar.

DIRETRIZES:
- Tom acolhedor, humano e profissional. Trate o paciente por "você". No máximo 1 ou 2 emojis.
- Objetivo principal: encaminhar para o AGENDAMENTO (avaliação). Peça nome completo, o procedimento/especialidade e uma preferência de dia/horário.
- Frases curtas e claras. Português do Brasil. Nunca use travessão (—); use vírgula, ponto ou dois-pontos.
- Preço: evite cravar valores exatos (variam); explique que depende de avaliação e ofereça o agendamento.
- Nunca invente valores, convênios, horários ou informação clínica. Se não souber, diga que vai confirmar e siga com o agendamento.
- Não dê diagnóstico. Em urgência, oriente procurar atendimento imediato.

FORMATO: devolva APENAS o texto pronto pra enviar ao paciente (sem aspas, sem "resposta sugerida:", sem explicações).`

// Valores padrão de um assistente novo.
export function defaultAssistant(): Omit<Assistant, 'id'> {
  return {
    name: 'Novo assistente',
    description: '',
    instructions: DEFAULT_INSTRUCTIONS,
    context: '',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    starters: ['Oi, quanto custa?', 'Vocês aceitam convênio?', 'Quero agendar uma avaliação'],
    knowledge: '',
    files: [],
  }
}

// Monta o system prompt final (instruções + contexto + conhecimento dos arquivos).
export function buildSystemPrompt(a: Pick<Assistant, 'instructions' | 'context' | 'knowledge'>): string {
  let p = a.instructions || ''
  const ctx = (a.context || '').trim()
  if (ctx) p += `\n\n─── CONTEXTO DA CLÍNICA ───\n${ctx}`
  const kn = (a.knowledge || '').trim()
  if (kn) p += `\n\n─── BASE DE CONHECIMENTO (arquivos) ───\n${kn}`
  return p
}

// Normaliza um registro do banco (preenche defaults e tipos).
export function normalizeAssistant(raw: Record<string, unknown>): Assistant {
  const d = defaultAssistant()
  return {
    id: String(raw.id),
    name: (raw.name as string) || d.name,
    description: (raw.description as string) || '',
    instructions: (raw.instructions as string) || d.instructions,
    context: (raw.context as string) || '',
    model: (raw.model as string) || d.model,
    temperature: typeof raw.temperature === 'number' ? (raw.temperature as number) : d.temperature,
    starters: Array.isArray(raw.starters) ? (raw.starters as string[]).filter((s) => s && s.trim()) : d.starters,
    knowledge: (raw.knowledge as string) || '',
    files: Array.isArray(raw.files) ? (raw.files as AssistantFile[]) : [],
  }
}
