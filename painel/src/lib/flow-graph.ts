// Modelo do grafo visual (o que o construtor arrasta) e a conversão
// para o formato que o MOTOR entende (flow-engine).
import type { Flow, FlowNode } from './flow-engine'

export type BlockType =
  | 'message'
  | 'menu'
  | 'handoff'
  | 'action'
  | 'tag'
  | 'condition'
  | 'randomizer'
  | 'delay'
  | 'flowjump'
  | 'integration'
  | 'image'
  | 'video'
  | 'file'
  | 'audio'

export type MenuOption = { id: string; label: string }
export type Branch = { id: string }

export type NodeData = {
  text?: string
  options?: MenuOption[] // menu
  action?: 'restart' | 'end' // action
  tagOp?: 'add' | 'remove' // tag
  tagName?: string // tag
  keyword?: string // condition
  branches?: Branch[] // randomizer
  randomMode?: 'random' | 'sequential' // randomizer
  seconds?: number // delay
  flowId?: string // flowjump
  flowName?: string // flowjump (só p/ exibir)
  url?: string // integration
  method?: string // integration
  imageUrl?: string // image
  mediaUrl?: string // video / file / audio
  fileName?: string // file
  caption?: string // image / video / file
}

export type GraphNode = {
  id: string
  type: BlockType
  position: { x: number; y: number }
  data: NodeData
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}

export type FlowGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const META: Record<BlockType, { label: string; emoji: string; color: string }> = {
  message: { label: 'Mensagem', emoji: '💬', color: 'emerald' },
  menu: { label: 'Menu', emoji: '📋', color: 'indigo' },
  handoff: { label: 'Atendente', emoji: '🙋', color: 'amber' },
  action: { label: 'Ação', emoji: '⚡', color: 'yellow' },
  tag: { label: 'Etiqueta', emoji: '🏷️', color: 'lime' },
  condition: { label: 'Condição', emoji: '🔀', color: 'sky' },
  randomizer: { label: 'Randomizador', emoji: '🎲', color: 'fuchsia' },
  delay: { label: 'Atraso', emoji: '⏱️', color: 'slate' },
  flowjump: { label: 'Conexão de fluxo', emoji: '🚀', color: 'rose' },
  integration: { label: 'Integração', emoji: '🔌', color: 'teal' },
  image: { label: 'Imagem', emoji: '🖼️', color: 'pink' },
  video: { label: 'Vídeo', emoji: '🎬', color: 'rose' },
  file: { label: 'Arquivo', emoji: '📎', color: 'slate' },
  audio: { label: 'Áudio', emoji: '🎵', color: 'violet' },
}

export function blockMeta(type: BlockType) {
  return META[type]
}

function edgeTarget(edges: GraphEdge[], source: string, handle?: string): string | undefined {
  return edges.find((e) => e.source === source && (e.sourceHandle ?? null) === (handle ?? null))?.target
}

// Converte um grafo desenhado -> fluxo executável pelo motor.
export function graphToFlow(graph: FlowGraph): Flow {
  const nodes: Record<string, FlowNode> = {}
  const targets = new Set(graph.edges.map((e) => e.target))
  const start = graph.nodes.find((n) => !targets.has(n.id)) ?? graph.nodes[0]

  for (const n of graph.nodes) {
    const d = n.data
    switch (n.type) {
      case 'message':
        nodes[n.id] = { type: 'message', text: d.text ?? '', next: edgeTarget(graph.edges, n.id) }
        break
      case 'menu':
        nodes[n.id] = {
          type: 'menu',
          text: d.text ?? '',
          options: (d.options ?? []).map((o) => ({
            label: o.label,
            next: edgeTarget(graph.edges, n.id, `opt-${o.id}`) ?? '',
          })),
        }
        break
      case 'handoff':
        nodes[n.id] = { type: 'handoff', text: d.text }
        break
      case 'action':
        nodes[n.id] = { type: 'action', action: d.action ?? 'restart', next: edgeTarget(graph.edges, n.id) }
        break
      case 'tag':
        nodes[n.id] = { type: 'tag', op: d.tagOp ?? 'add', tag: (d.tagName ?? '').trim(), next: edgeTarget(graph.edges, n.id) }
        break
      case 'condition':
        nodes[n.id] = {
          type: 'condition',
          keyword: d.keyword ?? '',
          yes: edgeTarget(graph.edges, n.id, 'yes'),
          no: edgeTarget(graph.edges, n.id, 'no'),
        }
        break
      case 'randomizer':
        nodes[n.id] = {
          type: 'randomizer',
          mode: d.randomMode ?? 'random',
          branches: (d.branches ?? []).map((b) => ({ next: edgeTarget(graph.edges, n.id, `br-${b.id}`) })),
        }
        break
      case 'delay':
        nodes[n.id] = { type: 'delay', seconds: d.seconds ?? 2, next: edgeTarget(graph.edges, n.id) }
        break
      case 'flowjump':
        nodes[n.id] = { type: 'flowjump', flowId: d.flowId ?? '' }
        break
      case 'integration':
        nodes[n.id] = { type: 'integration', url: d.url, method: d.method, next: edgeTarget(graph.edges, n.id) }
        break
      case 'image':
        nodes[n.id] = { type: 'image', url: d.imageUrl ?? '', caption: d.caption, next: edgeTarget(graph.edges, n.id) }
        break
      case 'video':
        nodes[n.id] = { type: 'video', url: d.mediaUrl ?? '', caption: d.caption, next: edgeTarget(graph.edges, n.id) }
        break
      case 'file':
        nodes[n.id] = { type: 'file', url: d.mediaUrl ?? '', fileName: d.fileName, caption: d.caption, next: edgeTarget(graph.edges, n.id) }
        break
      case 'audio':
        nodes[n.id] = { type: 'audio', url: d.mediaUrl ?? '', next: edgeTarget(graph.edges, n.id) }
        break
    }
  }

  return { start: start?.id ?? '', nodes }
}

// Cria o bloco padrão de cada tipo (usado ao adicionar no construtor).
export function newBlockData(type: BlockType): NodeData {
  const rid = () => crypto.randomUUID().slice(0, 6)
  switch (type) {
    case 'menu':
      return { text: 'Nova pergunta', options: [{ id: rid(), label: 'Opção 1' }] }
    case 'handoff':
      return { text: 'Vou te transferir para um atendente. 🙂' }
    case 'action':
      return { action: 'restart' }
    case 'tag':
      return { tagOp: 'add', tagName: '' }
    case 'condition':
      return { keyword: '' }
    case 'randomizer':
      return { branches: [{ id: rid() }, { id: rid() }], randomMode: 'random' }
    case 'delay':
      return { seconds: 2 }
    case 'flowjump':
      return { flowId: '', flowName: '' }
    case 'integration':
      return { url: '', method: 'GET' }
    case 'image':
      return { imageUrl: '', caption: '' }
    case 'video':
      return { mediaUrl: '', caption: '' }
    case 'file':
      return { mediaUrl: '', fileName: '', caption: '' }
    case 'audio':
      return { mediaUrl: '' }
    default:
      return { text: 'Nova mensagem' }
  }
}

// Fluxo padrão (pré-atendimento) — usado ao criar o 1º fluxo.
export const defaultGraph: FlowGraph = {
  nodes: [
    {
      id: 'boas_vindas',
      type: 'message',
      position: { x: 40, y: 40 },
      data: {
        text: 'Olá! 👋 Seja bem-vindo(a)!\nQue bom ter você por aqui. Vou te ajudar no que precisar.',
      },
    },
    {
      id: 'menu_principal',
      type: 'menu',
      position: { x: 40, y: 260 },
      data: {
        text: 'Como podemos te ajudar hoje?',
        options: [
          { id: 'o1', label: 'Agendar atendimento' },
          { id: 'o2', label: 'Tirar uma dúvida' },
          { id: 'o3', label: 'Localização / Endereço' },
          { id: 'o4', label: 'Falar com um atendente' },
        ],
      },
    },
    { id: 'consultas', type: 'message', position: { x: 420, y: 140 }, data: { text: 'Ótimo! 😊 Vou te encaminhar para um atendente confirmar o melhor horário pra você.' } },
    { id: 'exames', type: 'message', position: { x: 420, y: 300 }, data: { text: 'Perfeito! Me conta um pouco mais sobre o que você precisa que já te ajudo por aqui.' } },
    { id: 'localizacao', type: 'message', position: { x: 420, y: 460 }, data: { text: '📍 Peça nosso endereço e horário a um atendente. Já te encaminho!' } },
    { id: 'handoff', type: 'handoff', position: { x: 820, y: 300 }, data: { text: 'Prontinho! ✅ Vou te transferir para um atendente. Em instantes alguém continua por aqui. 🙂' } },
  ],
  edges: [
    { id: 'e1', source: 'boas_vindas', target: 'menu_principal' },
    { id: 'e2', source: 'menu_principal', target: 'consultas', sourceHandle: 'opt-o1' },
    { id: 'e3', source: 'menu_principal', target: 'exames', sourceHandle: 'opt-o2' },
    { id: 'e4', source: 'menu_principal', target: 'localizacao', sourceHandle: 'opt-o3' },
    { id: 'e5', source: 'menu_principal', target: 'handoff', sourceHandle: 'opt-o4' },
    { id: 'e6', source: 'consultas', target: 'handoff' },
    { id: 'e7', source: 'exames', target: 'handoff' },
    { id: 'e8', source: 'localizacao', target: 'menu_principal' },
  ],
}

// Grafo inicial de um fluxo NOVO (vazio): só uma mensagem de início.
export function blankGraph(): FlowGraph {
  return {
    nodes: [{ id: `message_${Date.now()}`, type: 'message', position: { x: 120, y: 120 }, data: { text: 'Nova mensagem' } }],
    edges: [],
  }
}
