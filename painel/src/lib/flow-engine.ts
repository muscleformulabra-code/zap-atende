// ─────────────────────────────────────────────────────────────
//  MOTOR DO CHATBOT (multi-fluxo)
//  Puro e síncrono. Recebe TODOS os fluxos (mapa por id), o estado
//  do contato e o que ele digitou; devolve as respostas e o novo estado.
//  "Conexão de fluxo" pula de um fluxo para outro.
// ─────────────────────────────────────────────────────────────

export type FlowNode =
  | { type: 'message'; text: string; delayMs?: number; next?: string }
  | { type: 'menu'; text: string; options: { label: string; next: string }[]; invalidText?: string }
  | { type: 'handoff'; text?: string }
  | { type: 'action'; action: 'restart' | 'end' }
  | { type: 'condition'; keyword: string; yes?: string; no?: string }
  | { type: 'randomizer'; branches: { next?: string }[] }
  | { type: 'delay'; seconds: number; next?: string }
  | { type: 'flowjump'; flowId: string }
  | { type: 'integration'; url?: string; method?: string; next?: string }
  | { type: 'image'; url: string; caption?: string; next?: string }
  | { type: 'goto'; next: string }

export type Flow = {
  start: string
  nodes: Record<string, FlowNode>
}

export type Flows = Record<string, Flow>

export type SessionStatus = 'active' | 'handoff' | 'done'

export type SessionState = {
  flowId: string
  currentNode: string | null
  status: SessionStatus
}

export type Reply = { text?: string; image?: string; caption?: string }
export type StepResult = { replies: Reply[]; state: SessionState }

function renderMenu(node: Extract<FlowNode, { type: 'menu' }>): string {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  const lines = node.options.map((o, i) => `${emojis[i] ?? `${i + 1}.`} ${o.label}`)
  return `${node.text}\n\n${lines.join('\n')}\n\n_Responda com o número da opção._`
}

function matchOption(
  node: Extract<FlowNode, { type: 'menu' }>,
  input: string
): { next: string } | null {
  const t = input.trim().toLowerCase()
  const n = parseInt(t, 10)
  if (!Number.isNaN(n) && n >= 1 && n <= node.options.length) return node.options[n - 1]
  const byLabel = node.options.find(
    (o) => o.label.toLowerCase() === t || (t.length > 2 && o.label.toLowerCase().includes(t))
  )
  return byLabel ?? null
}

// Caminha pelos fluxos a partir de um nó, emitindo mensagens, até parar
// num menu (espera resposta), num handoff (silencia) ou no fim.
function runFrom(
  flows: Flows,
  startFlowId: string,
  startNode: string | null,
  lastInput: string
): StepResult {
  const replies: Reply[] = []
  const visited = new Set<string>()
  let flowId = startFlowId
  let current: string | null = startNode

  while (current) {
    const flow = flows[flowId]
    if (!flow) break
    const key = `${flowId}:${current}`
    if (visited.has(key)) break // proteção contra loop infinito
    visited.add(key)

    const node: FlowNode | undefined = flow.nodes[current]
    if (!node) return { replies, state: { flowId, currentNode: null, status: 'done' } }

    switch (node.type) {
      case 'message':
        replies.push({ text: node.text })
        current = node.next ?? null
        break
      case 'goto':
        current = node.next
        break
      case 'delay':
        // No simulador segue direto; o WhatsApp real vai honrar o "digitando".
        current = node.next ?? null
        break
      case 'action':
        if (node.action === 'end') return { replies, state: { flowId, currentNode: null, status: 'done' } }
        current = flow.start // 'restart' volta ao início do fluxo atual
        break
      case 'condition': {
        const hit = node.keyword.trim().length > 0 &&
          lastInput.toLowerCase().includes(node.keyword.trim().toLowerCase())
        current = (hit ? node.yes : node.no) ?? null
        break
      }
      case 'randomizer': {
        const list = node.branches ?? []
        const pick = list[Math.floor(Math.random() * Math.max(list.length, 1))]
        current = pick?.next ?? null
        break
      }
      case 'flowjump': {
        const target = flows[node.flowId]
        if (!target) return { replies, state: { flowId, currentNode: null, status: 'done' } }
        flowId = node.flowId
        current = target.start
        break
      }
      case 'integration':
        // Simulador: passa direto (a chamada HTTP real fica pro conector).
        current = node.next ?? null
        break
      case 'image':
        replies.push({ image: node.url, caption: node.caption })
        current = node.next ?? null
        break
      case 'menu':
        replies.push({ text: renderMenu(node) })
        return { replies, state: { flowId, currentNode: current, status: 'active' } }
      case 'handoff':
        if (node.text) replies.push({ text: node.text })
        return { replies, state: { flowId, currentNode: current, status: 'handoff' } }
    }
  }
  return { replies, state: { flowId, currentNode: null, status: 'done' } }
}

// Começa a conversa (contato novo) no fluxo de entrada.
export function startSession(flows: Flows, entryFlowId: string): StepResult {
  const entry = flows[entryFlowId]
  if (!entry) return { replies: [], state: { flowId: entryFlowId, currentNode: null, status: 'done' } }
  return runFrom(flows, entryFlowId, entry.start, '')
}

// Avança com o que o contato digitou.
export function advance(flows: Flows, state: SessionState, input: string): StepResult {
  if (state.status !== 'active' || !state.currentNode) return { replies: [], state }
  const flow = flows[state.flowId]
  const node = flow?.nodes[state.currentNode]
  if (!node) return { replies: [], state: { ...state, currentNode: null, status: 'done' } }

  if (node.type === 'menu') {
    const choice = matchOption(node, input)
    if (!choice) {
      return { replies: [{ text: node.invalidText ?? `Não entendi. ${renderMenu(node)}` }], state }
    }
    return runFrom(flows, state.flowId, choice.next, input)
  }
  return runFrom(flows, state.flowId, 'next' in node ? node.next ?? null : null, input)
}
