import type { Flow } from './flow-engine'

// Fluxo de exemplo (PRÉ-ATENDIMENTO) — igual à ideia do BotConversa.
// Depois o construtor visual vai editar isso; por enquanto é o modelo do simulador.
export const sampleFlow: Flow = {
  start: 'boas_vindas',
  nodes: {
    boas_vindas: {
      type: 'message',
      text: 'Olá! 👋 Seja bem-vindo(a)!\nQue bom ter você por aqui. Vou te ajudar no que precisar.',
      delayMs: 1500,
      next: 'menu_principal',
    },
    menu_principal: {
      type: 'menu',
      text: 'Como podemos te ajudar hoje?',
      options: [
        { label: 'Agendar atendimento', next: 'consultas' },
        { label: 'Tirar uma dúvida', next: 'exames' },
        { label: 'Localização / Endereço', next: 'localizacao' },
        { label: 'Falar com um atendente', next: 'handoff' },
      ],
    },
    consultas: {
      type: 'message',
      text: 'Ótimo! 😊 Vou te encaminhar para um atendente confirmar o melhor horário pra você.',
      next: 'handoff',
    },
    exames: {
      type: 'message',
      text: 'Perfeito! Me conta um pouco mais sobre o que você precisa que já te ajudo por aqui.',
      next: 'handoff',
    },
    localizacao: {
      type: 'message',
      text: '📍 Peça nosso endereço e horário a um atendente. Já te encaminho!',
      next: 'menu_principal',
    },
    handoff: {
      type: 'handoff',
      text: 'Prontinho! ✅ Vou te transferir para um de nossos atendentes. Em instantes alguém continua seu atendimento por aqui. 🙂',
    },
  },
}
