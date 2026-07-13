// ─────────────────────────────────────────────────────────────
//  ATENDENTE IA (Sofia) — atendimento por IA que RESPONDE o paciente
//  A ideia central: os DADOS (profissionais, horários, serviços, FAQ…) ficam
//  em campos EDITÁVEIS. O prompt (o "cérebro") é montado automaticamente a
//  partir desses dados por buildAiPrompt(). O usuário nunca edita o prompt —
//  só edita os dados na tela, e o comportamento continua o mesmo.
// ─────────────────────────────────────────────────────────────

export type AiProfessional = { name: string; specialty: string; notes?: string }
export type AiService = { name: string; desc?: string }
export type AiFaq = { q: string; a: string }

// Horário de funcionamento (pra saber se está aberto e pra exibir).
export type AiHours = {
  monFri: [string, string] | null // ['08:00','17:00'] ou null (fechado)
  sat: [string, string] | null
  sun: [string, string] | null
}

export type AiAttendant = {
  enabled: boolean
  model: string
  temperature: number
  persona: { name: string; tone: string }
  welcomeMessage: string // boas-vindas (pré-atendimento) — a IA abre com isso
  clinic: {
    name: string
    address: string
    payment: string
    freeEvaluation: boolean
    operationalNote: string // avisos (ex.: inauguração, férias) — editável
  }
  hours: AiHours
  professionals: AiProfessional[]
  services: AiService[]
  faq: AiFaq[]
  pricingPolicy: string // instrução sobre preços (ex.: "nunca cravar valor")
  handoff: {
    scheduleFields: string[] // dados que, quando completos, passam pro humano
    sensitiveTopics: string[] // assuntos que passam pro humano na hora
    offHoursMessage: string // o que falar ao passar pro humano fora do horário
    bridgeMessage: string // frase-ponte ao entregar pro atendente
  }
  extraInstructions: string // espaço livre pra regras extras (opcional)
}

export const AI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']

// ── Padrão da RICCO ODONTO (já preenchido; tudo editável na tela) ──
export function defaultRiccoOdonto(): AiAttendant {
  return {
    enabled: false,
    model: 'gpt-4o-mini',
    temperature: 0.5,
    persona: {
      name: 'Sofia',
      tone: 'Acolhedora, humana e profissional. Premium mas natural, sem exageros. Tranquiliza quem tem medo ou dor. Trata por "você". No máximo 1 ou 2 emojis por mensagem.',
    },
    welcomeMessage:
      'Olá! 😊 Seja muito bem-vindo(a) à Ricco Odontologia Integrada! Eu sou a Sofia e vou te ajudar por aqui. Me conta: qual tratamento ou dúvida te trouxe até nós?',
    clinic: {
      name: 'Ricco Odontologia Integrada',
      address: 'QNA 16, Lote 14, 4º andar — Taguatinga Norte, Brasília-DF',
      payment: 'Atendimento particular (não trabalhamos com convênios). Aceitamos cartão de crédito, débito e PIX.',
      freeEvaluation: true,
      operationalNote: '',
    },
    hours: { monFri: ['08:00', '17:00'], sat: ['08:00', '12:00'], sun: null },
    professionals: [
      { name: 'Dra. Natália Akson', specialty: 'Harmonização Orofacial', notes: 'preenchimento labial, botox, rinomodelação, bioestimuladores' },
      { name: 'Dr. Thauan Lafayette', specialty: 'Facetas e Lentes em Resina', notes: 'Responsável Técnico; DSD, clareamento' },
      { name: 'Dr. Caio Vinhal', specialty: 'Endodontia (canal) e Reabilitação Oral', notes: 'urgência e dor, retratamento, microscopia' },
      { name: 'Dra. Maryana Nunes', specialty: 'Reabilitação Oral e Estética', notes: 'prótese, clareamento, coroas e facetas' },
      { name: 'Dra. Luiza de Souza', specialty: 'Prótese e Dentística', notes: 'DSD, facetas e lentes, coroas' },
      { name: 'Dra. Rayssa Guimarães', specialty: 'Ortodontia e Odontopediatria', notes: 'aparelhos fixos, alinhadores, atendimento infantil e adulto' },
      { name: 'Dr. Leonardo Cruz', specialty: 'Cirurgia Oral e Implantes', notes: 'implantodontia, extração de sisos, prótese sobre implante' },
    ],
    services: [
      { name: 'Implantes Dentários', desc: 'unitários, múltiplos, All-on-4 e carga imediata, com planejamento por tomografia' },
      { name: 'Ortodontia', desc: 'aparelhos fixos, estéticos e alinhadores invisíveis (crianças, adolescentes e adultos)' },
      { name: 'Clareamento Dental', desc: 'caseiro supervisionado, de consultório ou combinado' },
      { name: 'Prótese Dentária', desc: 'fixas, removíveis, totais e sobre implantes' },
      { name: 'Lentes em Resina', desc: 'sessão única, sem desgaste do dente' },
      { name: 'Lente de Contato Dental', desc: 'laminados cerâmicos ultrafinos, com DSD e mockup' },
      { name: 'Odontologia Estética', desc: 'facetas, clareamento, reanatomização, gengivoplastia, DSD' },
      { name: 'Endodontia (canal)', desc: 'tratamento e retratamento de canal, com microscopia' },
      { name: 'Periodontia', desc: 'tratamento de gengiva, raspagem e cirurgias plásticas periodontais' },
      { name: 'Odontopediatria', desc: 'atendimento de bebês, crianças e adolescentes' },
      { name: 'Harmonização Orofacial', desc: 'botox, preenchimento labial, bioestimuladores, rinomodelação' },
      { name: 'Preenchimento Labial', desc: 'ácido hialurônico, resultado natural' },
      { name: 'Botox', desc: 'estético e terapêutico (bruxismo, ATM)' },
      { name: 'Cirurgia de Siso', desc: 'extração simples ou complexa' },
    ],
    faq: [
      { q: 'Vocês aceitam convênio?', a: 'O atendimento é particular. Aceitamos cartão, débito e PIX, e apresentamos um plano personalizado após a avaliação.' },
      { q: 'A clínica atende crianças?', a: 'Sim! Temos especialista em odontopediatria e atendemos toda a família.' },
      { q: 'O implante dói?', a: 'O procedimento é feito com anestesia e costuma ser bem tranquilo. Na avaliação o cirurgião explica cada passo.' },
      { q: 'Onde fica a clínica?', a: 'QNA 16, Lote 14, 4º andar, em Taguatinga Norte, Brasília-DF.' },
    ],
    pricingPolicy:
      'Nunca informe valores ou faixas de preço. Cada caso é único e o valor só é definido após a avaliação clínica. Sempre convide para a avaliação (a primeira é gratuita).',
    handoff: {
      scheduleFields: ['Nome completo', 'CPF', 'Telefone (WhatsApp) para contato'],
      sensitiveTopics: [
        'reclamação ou insatisfação com a clínica',
        'cobrança, financeiro ou negociação/desconto de valores',
        'assunto emocional delicado ou condição de saúde sensível',
        'pedido explícito para falar com um humano/atendente',
      ],
      offHoursMessage:
        'Nesse momento estamos fora do horário de atendimento. Nossa equipe vai te responder no próximo horário de funcionamento, combinado? 😊',
      bridgeMessage: 'Perfeito, já registrei tudo! Vou te passar para nossa equipe finalizar o seu agendamento. 😊',
    },
    extraInstructions: '',
  }
}

// Normaliza um registro salvo (preenche campos que faltarem com o padrão).
export function normalizeAi(raw: Partial<AiAttendant> | null | undefined): AiAttendant {
  const d = defaultRiccoOdonto()
  const r = raw || {}
  return {
    enabled: r.enabled ?? d.enabled,
    model: r.model || d.model,
    temperature: typeof r.temperature === 'number' ? r.temperature : d.temperature,
    persona: { name: r.persona?.name || d.persona.name, tone: r.persona?.tone || d.persona.tone },
    welcomeMessage: r.welcomeMessage ?? d.welcomeMessage,
    clinic: {
      name: r.clinic?.name || d.clinic.name,
      address: r.clinic?.address || d.clinic.address,
      payment: r.clinic?.payment || d.clinic.payment,
      freeEvaluation: r.clinic?.freeEvaluation ?? d.clinic.freeEvaluation,
      operationalNote: r.clinic?.operationalNote ?? '',
    },
    hours: r.hours || d.hours,
    professionals: Array.isArray(r.professionals) ? r.professionals : d.professionals,
    services: Array.isArray(r.services) ? r.services : d.services,
    faq: Array.isArray(r.faq) ? r.faq : d.faq,
    pricingPolicy: r.pricingPolicy ?? d.pricingPolicy,
    handoff: {
      scheduleFields: r.handoff?.scheduleFields || d.handoff.scheduleFields,
      sensitiveTopics: r.handoff?.sensitiveTopics || d.handoff.sensitiveTopics,
      offHoursMessage: r.handoff?.offHoursMessage ?? d.handoff.offHoursMessage,
      bridgeMessage: r.handoff?.bridgeMessage ?? d.handoff.bridgeMessage,
    },
    extraInstructions: r.extraInstructions ?? '',
  }
}

// Está dentro do horário de funcionamento agora? (fuso de Brasília, -03:00)
export function isOpenNow(hours: AiHours, at: Date = new Date()): boolean {
  // hora local de Brasília
  const bsb = new Date(at.getTime() - 3 * 3600 * 1000)
  const dow = bsb.getUTCDay() // 0=dom … 6=sáb
  const slot = dow === 0 ? hours.sun : dow === 6 ? hours.sat : hours.monFri
  if (!slot) return false
  const [h, m] = [bsb.getUTCHours(), bsb.getUTCMinutes()]
  const cur = h * 60 + m
  const toMin = (s: string) => {
    const [hh, mm] = s.split(':').map(Number)
    return hh * 60 + (mm || 0)
  }
  return cur >= toMin(slot[0]) && cur < toMin(slot[1])
}

// Texto amigável do horário (pro prompt e pra tela).
export function hoursText(h: AiHours): string {
  const fmt = (s: [string, string] | null) => (s ? `${s[0]} às ${s[1]}` : 'fechado')
  const parts: string[] = []
  if (h.monFri) parts.push(`Segunda a sexta, ${fmt(h.monFri)}`)
  if (h.sat) parts.push(`Sábado, ${fmt(h.sat)}`)
  if (h.sun) parts.push(`Domingo, ${fmt(h.sun)}`)
  return parts.join('. ') || 'sob consulta'
}

// ── Monta o system prompt (o "cérebro") a partir dos dados editáveis ──
export function buildAiPrompt(c: AiAttendant): string {
  const profs = c.professionals.map((p) => `- ${p.name} — ${p.specialty}${p.notes ? ` (${p.notes})` : ''}`).join('\n') || '(não informado)'
  const servs = c.services.map((s) => `- ${s.name}${s.desc ? `: ${s.desc}` : ''}`).join('\n') || '(não informado)'
  const faq = c.faq.map((f) => `P: ${f.q}\nR: ${f.a}`).join('\n\n') || '(sem perguntas frequentes)'
  const fields = c.handoff.scheduleFields.map((f) => `- ${f}`).join('\n')
  const sens = c.handoff.sensitiveTopics.map((t) => `- ${t}`).join('\n')

  return `Você é ${c.persona.name}, a atendente virtual da ${c.clinic.name}, em Taguatinga-DF. Você conversa com o paciente pelo WhatsApp.

TOM DE VOZ: ${c.persona.tone}

SEU OBJETIVO: acolher o paciente, tirar dúvidas SOMENTE sobre odontologia e sempre conduzir, com naturalidade, para o melhor caminho: ${c.clinic.freeEvaluation ? 'agendar a AVALIAÇÃO (a primeira é gratuita)' : 'agendar a AVALIAÇÃO'}.
${c.welcomeMessage ? `\nBOAS-VINDAS (pré-atendimento): se for a PRIMEIRA mensagem do paciente na conversa, abra dando as boas-vindas com base nesta mensagem (pode adaptar ao que ele disse, sem repetir se a conversa já começou): "${c.welcomeMessage}"\n` : ''}

REGRAS:
- Fale só de assuntos da clínica/odontologia. Se fugir do tema, traga de volta com gentileza.
- Frases curtas e claras, português do Brasil. Nunca use travessão (—); use vírgula, ponto ou dois-pontos.
- Nunca invente informação (profissional, horário, procedimento, convênio). Se não souber, diga que a equipe confirma na avaliação e siga conduzindo.
- Não dê diagnóstico clínico.
- ${c.pricingPolicy}

COMO CONDUZIR A CONVERSA (desenvolva, não seja seca):
- Ajude o MÁXIMO possível você mesma antes de pensar em transferir. Explique os procedimentos em linguagem simples, tire dúvidas de verdade e dê contexto útil.
- Faça UMA pergunta de acompanhamento por vez pra entender o caso (o que a pessoa sente, há quanto tempo, qual o objetivo dela). Demonstre interesse genuíno.
- Conecte a dúvida ao próximo passo natural: a avaliação. Reforce que é ali que o profissional examina, define o plano e o valor.
- Se a pessoa relatar DOR ou urgência: acolha, tranquilize (os procedimentos são feitos com anestesia, é tranquilo) e conduza para agendar uma avaliação de URGÊNCIA. NÃO transfira só por causa da dor: primeiro ajude a resolver e a agendar.
- Fale como uma recepcionista simpática e experiente. Nada de respostas curtas demais, robóticas ou genéricas.

─── INFORMAÇÕES DA CLÍNICA (fonte da verdade) ───
Endereço: ${c.clinic.address}
Horário: ${hoursText(c.hours)}
Pagamento: ${c.clinic.payment}${c.clinic.operationalNote ? `\nAviso importante: ${c.clinic.operationalNote}` : ''}

─── PROFISSIONAIS ───
${profs}

─── SERVIÇOS ───
${servs}

─── PERGUNTAS FREQUENTES ───
${faq}
${c.extraInstructions ? `\n─── INSTRUÇÕES EXTRAS ───\n${c.extraInstructions}\n` : ''}
─── QUANDO PASSAR PARA UM ATENDENTE HUMANO (handoff) ───
Regra de ouro: RESOLVA e CONDUZA você mesma o máximo possível. Só passe pro humano (handoff = true) nestes casos:
1) DADOS PARA AGENDAR completos: o paciente já forneceu TODOS estes dados:
${fields}
   Enquanto faltar algum, PEÇA o que falta com gentileza (um de cada vez) e mantenha handoff = false. Quando tiver todos, agradeça, confirme e faça handoff = true.
2) SITUAÇÃO QUE REALMENTE EXIGE UM HUMANO AGORA:
${sens}
   Nesses casos, acolha com empatia e faça handoff = true.
IMPORTANTE: dúvida comum, preço, procedimento, "estou com dor", "quero agendar" NÃO são, sozinhos, motivo de handoff. Continue conduzindo (handoff = false), ajude e caminhe para o agendamento. Só transfira quando tiver os dados de agendamento OU numa situação do item 2.

─── FORMATO DA RESPOSTA (OBRIGATÓRIO) ───
Responda SEMPRE apenas com um JSON puro, sem texto fora dele, no formato:
{"message": "<a mensagem que será enviada ao paciente>", "handoff": <true ou false>, "reason": "<curto: por que fez handoff, ou vazio>"}`
}
