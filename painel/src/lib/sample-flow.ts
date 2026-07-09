import type { Flow } from './flow-engine'

// Fluxo de exemplo (PRÉ-ATENDIMENTO) — igual à ideia do BotConversa.
// Depois o construtor visual vai editar isso; por enquanto é o modelo do simulador.
export const sampleFlow: Flow = {
  start: 'boas_vindas',
  nodes: {
    boas_vindas: {
      type: 'message',
      text: 'Olá! 👋 Seja bem-vindo(a) ao *Centro Médico da Família*.\nSomos um centro integrado de saúde, odontologia e bem-estar.',
      delayMs: 1500,
      next: 'menu_principal',
    },
    menu_principal: {
      type: 'menu',
      text: 'Como podemos te ajudar hoje?',
      options: [
        { label: 'Consultas Médicas', next: 'consultas' },
        { label: 'Orçamento de Exames', next: 'exames' },
        { label: 'Localização / Endereço', next: 'localizacao' },
        { label: 'Falar com um atendente', next: 'handoff' },
      ],
    },
    consultas: {
      type: 'message',
      text: 'Ótimo! 😊 Temos várias especialidades disponíveis. Vou te encaminhar para um atendente confirmar o melhor horário pra você.',
      next: 'handoff',
    },
    exames: {
      type: 'message',
      text: 'Perfeito! Para o orçamento, me envie a *lista de exames* (foto do pedido médico serve). Já já um atendente te retorna com os valores.',
      next: 'handoff',
    },
    localizacao: {
      type: 'message',
      text: '📍 Estamos na QNA 16, Lote 14, 4º andar — Av. Comercial Norte, Taguatinga Norte - DF.\nHorário: seg a sex, 8h às 18h.',
      next: 'menu_principal',
    },
    handoff: {
      type: 'handoff',
      text: 'Prontinho! ✅ Vou te transferir para um de nossos atendentes. Em instantes alguém continua seu atendimento por aqui. 🙂',
    },
  },
}
