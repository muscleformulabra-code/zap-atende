'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  blockMeta,
  newBlockData,
  type BlockType,
  type FlowGraph,
  type MenuOption,
  type NodeData,
} from '@/lib/flow-graph'

// Alturas fixas dos blocos com múltiplas saídas (usadas pra posicionar os pontos de conexão).
const NODE_W = 256
const HEADER_H = 42
const TEXT_H = 46
const ROW_H = 34

// Estilos (classes ESTÁTICAS pro Tailwind não podar) por tipo de bloco.
type Style = { accent: string; chip: string; ring: string; hover: string; handle: string; label: string }
const S: Record<BlockType, Style> = {
  message:     { accent: 'before:bg-emerald-400', chip: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400/60', hover: 'hover:border-emerald-300 hover:bg-emerald-50/40', handle: '!bg-emerald-400', label: 'text-emerald-700' },
  image:       { accent: 'before:bg-pink-400',    chip: 'bg-pink-100 text-pink-700',       ring: 'ring-pink-400/60',    hover: 'hover:border-pink-300 hover:bg-pink-50/40',       handle: '!bg-pink-400',    label: 'text-pink-700' },
  menu:        { accent: 'before:bg-indigo-400',  chip: 'bg-indigo-100 text-indigo-700',   ring: 'ring-indigo-400/60',  hover: 'hover:border-indigo-300 hover:bg-indigo-50/40',   handle: '!bg-indigo-400',  label: 'text-indigo-700' },
  condition:   { accent: 'before:bg-sky-400',     chip: 'bg-sky-100 text-sky-700',         ring: 'ring-sky-400/60',     hover: 'hover:border-sky-300 hover:bg-sky-50/40',         handle: '!bg-sky-400',     label: 'text-sky-700' },
  randomizer:  { accent: 'before:bg-fuchsia-400', chip: 'bg-fuchsia-100 text-fuchsia-700', ring: 'ring-fuchsia-400/60', hover: 'hover:border-fuchsia-300 hover:bg-fuchsia-50/40', handle: '!bg-fuchsia-400', label: 'text-fuchsia-700' },
  delay:       { accent: 'before:bg-slate-400',   chip: 'bg-slate-100 text-slate-700',     ring: 'ring-slate-400/60',   hover: 'hover:border-slate-300 hover:bg-slate-50',        handle: '!bg-slate-400',   label: 'text-slate-700' },
  action:      { accent: 'before:bg-amber-400',   chip: 'bg-amber-100 text-amber-700',     ring: 'ring-amber-400/60',   hover: 'hover:border-amber-300 hover:bg-amber-50/40',     handle: '!bg-amber-400',   label: 'text-amber-700' },
  tag:         { accent: 'before:bg-lime-400',    chip: 'bg-lime-100 text-lime-700',       ring: 'ring-lime-400/60',    hover: 'hover:border-lime-300 hover:bg-lime-50/40',       handle: '!bg-lime-400',    label: 'text-lime-700' },
  video:       { accent: 'before:bg-rose-400',    chip: 'bg-rose-100 text-rose-700',       ring: 'ring-rose-400/60',    hover: 'hover:border-rose-300 hover:bg-rose-50/40',       handle: '!bg-rose-400',    label: 'text-rose-700' },
  file:        { accent: 'before:bg-slate-400',   chip: 'bg-slate-100 text-slate-700',     ring: 'ring-slate-400/60',   hover: 'hover:border-slate-300 hover:bg-slate-50',        handle: '!bg-slate-400',   label: 'text-slate-700' },
  audio:       { accent: 'before:bg-violet-400',  chip: 'bg-violet-100 text-violet-700',   ring: 'ring-violet-400/60',  hover: 'hover:border-violet-300 hover:bg-violet-50/40',   handle: '!bg-violet-400',  label: 'text-violet-700' },
  flowjump:    { accent: 'before:bg-rose-400',    chip: 'bg-rose-100 text-rose-700',       ring: 'ring-rose-400/60',    hover: 'hover:border-rose-300 hover:bg-rose-50/40',       handle: '!bg-rose-400',    label: 'text-rose-700' },
  integration: { accent: 'before:bg-teal-400',    chip: 'bg-teal-100 text-teal-700',       ring: 'ring-teal-400/60',    hover: 'hover:border-teal-300 hover:bg-teal-50/40',       handle: '!bg-teal-400',    label: 'text-teal-700' },
  handoff:     { accent: 'before:bg-orange-400',  chip: 'bg-orange-100 text-orange-700',   ring: 'ring-orange-400/60',  hover: 'hover:border-orange-300 hover:bg-orange-50/40',   handle: '!bg-orange-400',  label: 'text-orange-700' },
}

// Bolinhas de conexão maiores e visíveis (saída = arraste daqui; entrada = solte aqui).
const HANDLE = '!h-5 !w-5 !border-[3px] !border-white !shadow-md transition-transform hover:!scale-125 !cursor-crosshair'

function Shell({ type, selected, isStart, children }: { type: BlockType; selected?: boolean; isStart?: boolean; children: React.ReactNode }) {
  const m = blockMeta(type)
  const s = S[type]
  return (
    <div
      style={{ width: NODE_W }}
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-md transition
        before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:content-[''] ${s.accent}
        ${selected ? `border-transparent ring-2 ${s.ring}` : 'border-gray-200'}`}
    >
      <div style={{ height: HEADER_H }} className="flex items-center gap-2 pl-4 pr-3">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${s.chip}`}>{m.emoji}</span>
        <span className={`text-[13px] font-semibold ${s.label}`}>{m.label}</span>
        {isStart && <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">início</span>}
      </div>
      {children}
    </div>
  )
}

function bodyText(t: BlockType, d: NodeData): string {
  switch (t) {
    case 'message': return d.text || 'Clique para escrever a mensagem…'
    case 'delay': return `⏱️ Espera ${d.seconds ?? 2}s mostrando “digitando…”`
    case 'integration': return d.url || 'URL não configurada'
    case 'image': return d.imageUrl ? `🖼️ ${d.caption || 'imagem'}` : 'Cole a URL da imagem…'
    case 'video': return d.mediaUrl ? `🎬 ${d.caption || 'vídeo'}` : 'Envie ou cole a URL do vídeo…'
    case 'file': return d.mediaUrl ? `📎 ${d.fileName || d.caption || 'arquivo'}` : 'Envie ou cole a URL do arquivo…'
    case 'audio': return d.mediaUrl ? '🎵 áudio' : 'Envie ou cole a URL do áudio…'
    case 'handoff': return d.text || 'Passa para o atendente humano'
    case 'action': return d.action === 'end' ? '🛑 Encerrar conversa' : '🔄 Reiniciar automação (encerra após o clique)'
    case 'tag': return `${d.tagOp === 'remove' ? '➖ Remover' : '➕ Adicionar'} etiqueta: ${d.tagName?.trim() || '(defina o nome)'}`
    case 'flowjump': return d.flowName ? `→ ${d.flowName}` : 'Escolha um fluxo de destino…'
    default: return ''
  }
}

function NextRow({ type }: { type: BlockType }) {
  return (
    <div className="relative flex items-center justify-end gap-1.5 border-t border-gray-100 bg-gray-50/70 px-4 py-2 pr-6 text-[11px] font-semibold text-gray-500">
      arraste para ligar <span className={S[type].label}>→</span>
      <Handle type="source" position={Position.Right} className={`${HANDLE} ${S[type].handle}`} />
    </div>
  )
}

// Blocos de uma saída ("próximo") e os terminais (handoff/action, sem saída).
function SimpleNode({ type, data, selected }: NodeProps) {
  const t = type as BlockType
  const d = data as NodeData & { __start?: boolean }
  const hasNext = t === 'message' || t === 'delay' || t === 'integration' || t === 'image' || t === 'video' || t === 'file' || t === 'audio' || t === 'tag'
  return (
    <Shell type={t} selected={selected} isStart={d.__start}>
      <Handle type="target" position={Position.Left} className={`${HANDLE} !bg-gray-300`} />
      <div className="whitespace-pre-wrap px-4 pb-2.5 pt-1 text-xs leading-relaxed text-gray-600">{bodyText(t, d)}</div>
      {hasNext ? <NextRow type={t} /> : (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-1.5 text-[11px] font-medium text-gray-400">Fim do fluxo</div>
      )}
    </Shell>
  )
}

function MenuNode({ data, selected }: NodeProps) {
  const d = data as NodeData & { __start?: boolean }
  const options = d.options ?? []
  return (
    <Shell type="menu" selected={selected} isStart={d.__start}>
      <Handle type="target" position={Position.Left} className={`${HANDLE} !bg-gray-300`} />
      <div className="overflow-hidden px-4 pb-1.5 pt-0.5 text-xs leading-relaxed text-gray-600" style={{ height: TEXT_H }}>{d.text || 'Pergunta do menu…'}</div>
      {options.map((o, i) => (
        <div key={o.id} className="relative flex items-center border-t border-gray-100 px-4 text-xs text-gray-700" style={{ height: ROW_H }}>
          <span className="mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">{i + 1}</span>
          <span className="truncate">{o.label}</span>
          <Handle type="source" id={`opt-${o.id}`} position={Position.Right} className={`${HANDLE} !bg-indigo-400`} style={{ top: HEADER_H + TEXT_H + i * ROW_H + ROW_H / 2 }} />
        </div>
      ))}
    </Shell>
  )
}

function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData & { __start?: boolean }
  const info = 38
  return (
    <Shell type="condition" selected={selected} isStart={d.__start}>
      <Handle type="target" position={Position.Left} className={`${HANDLE} !bg-gray-300`} />
      <div className="overflow-hidden px-4 pb-1.5 pt-0.5 text-xs text-gray-600" style={{ height: info }}>Se contém: <b>“{d.keyword || '—'}”</b></div>
      <div className="relative flex items-center border-t border-gray-100 px-4 text-xs font-medium text-emerald-600" style={{ height: ROW_H }}>
        ✅ sim
        <Handle type="source" id="yes" position={Position.Right} className={`${HANDLE} !bg-emerald-400`} style={{ top: HEADER_H + info + ROW_H / 2 }} />
      </div>
      <div className="relative flex items-center border-t border-gray-100 px-4 text-xs font-medium text-rose-500" style={{ height: ROW_H }}>
        🚫 não
        <Handle type="source" id="no" position={Position.Right} className={`${HANDLE} !bg-rose-400`} style={{ top: HEADER_H + info + ROW_H + ROW_H / 2 }} />
      </div>
    </Shell>
  )
}

function RandomizerNode({ data, selected }: NodeProps) {
  const d = data as NodeData & { __start?: boolean }
  const branches = d.branches ?? []
  const info = 32
  return (
    <Shell type="randomizer" selected={selected} isStart={d.__start}>
      <Handle type="target" position={Position.Left} className={`${HANDLE} !bg-gray-300`} />
      <div className="px-4 pb-1.5 pt-0.5 text-xs text-gray-500" style={{ height: info }}>Divide aleatoriamente:</div>
      {branches.map((b, i) => (
        <div key={b.id} className="relative flex items-center border-t border-gray-100 px-4 text-xs text-gray-700" style={{ height: ROW_H }}>
          🎲 Caminho {i + 1}
          <Handle type="source" id={`br-${b.id}`} position={Position.Right} className={`${HANDLE} !bg-fuchsia-400`} style={{ top: HEADER_H + info + i * ROW_H + ROW_H / 2 }} />
        </div>
      ))}
    </Shell>
  )
}

const nodeTypes = {
  message: SimpleNode,
  delay: SimpleNode,
  integration: SimpleNode,
  image: SimpleNode,
  video: SimpleNode,
  file: SimpleNode,
  audio: SimpleNode,
  tag: SimpleNode,
  handoff: SimpleNode,
  action: SimpleNode,
  flowjump: SimpleNode,
  menu: MenuNode,
  condition: ConditionNode,
  randomizer: RandomizerNode,
}

// Paleta agrupada (barra lateral esquerda).
const GROUPS: { title: string; blocks: BlockType[] }[] = [
  { title: 'Conteúdo', blocks: ['message', 'image', 'video', 'file', 'audio', 'menu'] },
  { title: 'Lógica', blocks: ['condition', 'randomizer', 'delay', 'action', 'tag'] },
  { title: 'Conexão', blocks: ['flowjump', 'integration', 'handoff'] },
]

type FlowItem = { id: string; name: string; is_active: boolean }

export default function Construtor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [flowId, setFlowId] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('')
  const [allFlows, setAllFlows] = useState<FlowItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading')

  useEffect(() => {
    ;(async () => {
      const list: FlowItem[] = await (await fetch('/api/flows')).json()
      setAllFlows(list)
      const paramId = new URLSearchParams(window.location.search).get('id')
      const target = paramId ?? list.find((f) => f.is_active)?.id ?? list[0]?.id
      if (!target) return setStatus('ready')
      const data = await (await fetch(`/api/flows/${target}`)).json()
      setFlowId(data.id)
      setFlowName(data.name)
      const g: FlowGraph = data.definition
      setNodes(g.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })))
      setEdges(g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined })))
      setStatus('ready')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // O bloco de início é o único sem seta chegando — marca visualmente.
  const startId = useMemo(() => {
    const targets = new Set(edges.map((e) => e.target))
    return nodes.find((n) => !targets.has(n.id))?.id
  }, [nodes, edges])
  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...(n.data as NodeData), __start: n.id === startId } })),
    [nodes, startId]
  )

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...c, id: `e${Date.now()}` },
          eds.filter((e) => !(e.source === c.source && (e.sourceHandle ?? null) === (c.sourceHandle ?? null)))
        )
      )
    },
    [setEdges]
  )

  function addBlock(type: BlockType) {
    const id = `${type}_${Date.now()}`
    setNodes((ns) => [...ns, { id, type, position: { x: 220 + Math.random() * 160, y: 120 + Math.random() * 200 }, data: newBlockData(type) }])
    setSelectedId(id)
  }

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const selData = selected?.data as NodeData | undefined
  const selType = selected?.type as BlockType | undefined

  function updateData(id: string, patch: Partial<NodeData>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as NodeData), ...patch } } : n)))
  }

  function removeNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setSelectedId(null)
  }

  function removeHandleEdges(nodeId: string, handle: string) {
    setEdges((eds) => eds.filter((e) => !(e.source === nodeId && e.sourceHandle === handle)))
  }

  async function save() {
    if (!flowId) return
    setStatus('saving')
    const definition: FlowGraph = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type as BlockType, position: n.position, data: n.data as NodeData })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
    }
    await fetch(`/api/flows/${flowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition }),
    })
    setStatus('saved')
    setTimeout(() => setStatus('ready'), 1500)
  }

  const menuOptions = selData?.options ?? []

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <a href="/fluxos" className="text-sm text-gray-400 hover:text-gray-700">← fluxos</a>
        <h1 className="text-[15px] font-bold text-gray-900">{flowName || 'Construtor'}</h1>
        <span className="text-xs text-gray-300">•</span>
        <span className="text-xs text-gray-400">
          {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'arraste os blocos e ligue os pontinhos'}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <a href="/simulador" target="_blank" className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800">▶ testar</a>
          <button onClick={save} disabled={status === 'saving' || !flowId} className="rounded-lg bg-emerald-500 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50">
            {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* PALETA DE BLOCOS (barra lateral) */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-3">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Blocos</div>
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-300">{g.title}</div>
              <div className="space-y-1">
                {g.blocks.map((t) => {
                  const m = blockMeta(t)
                  const s = S[t]
                  return (
                    <button
                      key={t}
                      onClick={() => addBlock(t)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-gray-50 px-2.5 py-2 text-left transition ${s.hover}`}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${s.chip}`}>{m.emoji}</span>
                      <span className="text-[13px] font-medium text-gray-700">{m.label}</span>
                      <span className="ml-auto text-gray-300">+</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* CANVAS */}
        <div className="h-full flex-1">
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: '#10b981', strokeWidth: 2.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 18, height: 18 } }}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: '#10b981', strokeWidth: 2.5, strokeDasharray: '6 4' }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#d1d5db" />
            <Controls showInteractive={false} />
            <MiniMap zoomable pannable className="!rounded-xl" />
          </ReactFlow>
        </div>

        {/* PAINEL DE EDIÇÃO */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4">
          {!selected && (
            <div className="text-sm text-gray-500">
              <p className="mb-3 font-semibold text-gray-700">Editando: {flowName || '—'}</p>
              <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-[13px]">
                <p>👈 Clique num <b>bloco</b> da esquerda pra adicionar.</p>
                <p>🔗 Ligue arrastando do <b>pontinho da direita</b> de um bloco até a <b>esquerda</b> do próximo.</p>
                <p>✏️ Clique num bloco no quadro pra editar aqui.</p>
                <p>💾 <b>Salvar</b> e testar em <b>▶ testar</b>.</p>
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[12px] text-amber-700">💡 Depois de todo <b>Menu</b>, ligue um bloco <b>⚡ Ação → Reiniciar automação</b> pra encerrar após o clique (evita spam e risco de ban).</p>
            </div>
          )}

          {selected && selType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${S[selType].label}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${S[selType].chip}`}>{blockMeta(selType).emoji}</span>
                  {blockMeta(selType).label}
                </span>
                <button onClick={() => removeNode(selected.id)} className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">excluir</button>
              </div>

              {(selType === 'message' || selType === 'handoff') && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Texto</span>
                  <textarea value={selData?.text ?? ''} onChange={(e) => updateData(selected.id, { text: e.target.value })} rows={5} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
                </label>
              )}

              {selType === 'menu' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Pergunta do menu</span>
                    <textarea value={selData?.text ?? ''} onChange={(e) => updateData(selected.id, { text: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-indigo-500" />
                  </label>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Opções</span>
                    <div className="mt-1 space-y-2">
                      {menuOptions.map((o, i) => {
                        const connected = edges.some((e) => e.source === selected.id && e.sourceHandle === `opt-${o.id}`)
                        return (
                          <div key={o.id} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">{i + 1}</span>
                            <input value={o.label} onChange={(e) => updateData(selected.id, { options: menuOptions.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })} className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                            <span title={connected ? 'ligada' : 'sem destino'} className={connected ? 'text-emerald-500' : 'text-gray-300'}>●</span>
                            <button onClick={() => { updateData(selected.id, { options: menuOptions.filter((x) => x.id !== o.id) }); removeHandleEdges(selected.id, `opt-${o.id}`) }} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => updateData(selected.id, { options: [...menuOptions, { id: crypto.randomUUID().slice(0, 6), label: `Opção ${menuOptions.length + 1}` } as MenuOption] })} className="mt-2 text-sm font-medium text-indigo-600 hover:underline">+ adicionar opção</button>
                  </div>
                  <p className="rounded-lg bg-amber-50 p-2.5 text-[12px] text-amber-700">💡 Ligue um bloco <b>⚡ Ação → Reiniciar automação</b> no fim de cada opção pra encerrar após o clique (anti-spam).</p>
                </>
              )}

              {selType === 'action' && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">O que fazer</span>
                  <select value={selData?.action ?? 'restart'} onChange={(e) => updateData(selected.id, { action: e.target.value as 'restart' | 'end' })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm">
                    <option value="restart">🔄 Reiniciar automação (encerra após o clique)</option>
                    <option value="end">🛑 Encerrar a conversa</option>
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">A automação <b>para</b> depois deste bloco — o paciente pode clicar à vontade que não vira spam. O atendente assume pelo inbox.</p>
                </label>
              )}

              {selType === 'tag' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">O que fazer</span>
                    <select value={selData?.tagOp ?? 'add'} onChange={(e) => updateData(selected.id, { tagOp: e.target.value as 'add' | 'remove' })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm">
                      <option value="add">➕ Adicionar etiqueta</option>
                      <option value="remove">➖ Remover etiqueta</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Nome da etiqueta</span>
                    <input value={selData?.tagName ?? ''} onChange={(e) => updateData(selected.id, { tagName: e.target.value })} placeholder="ex: lead-cardiologia" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-lime-500" />
                  </label>
                  <p className="text-[11px] text-gray-400">A etiqueta é marcada no contato quando o fluxo passa por aqui. Use pra segmentar (ex: quem escolhe Cardiologia). O bloco <b>segue direto</b> pro próximo.</p>
                </>
              )}

              {selType === 'condition' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Se a mensagem contém…</span>
                    <input value={selData?.keyword ?? ''} onChange={(e) => updateData(selected.id, { keyword: e.target.value })} placeholder="ex: convênio" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-sky-500" />
                  </label>
                  <p className="text-[11px] text-gray-400">Saída <b className="text-emerald-600">✅ sim</b> se conter a palavra; <b className="text-rose-600">🚫 não</b> caso contrário. Ligue as duas no quadro.</p>
                </>
              )}

              {selType === 'randomizer' && (
                <div>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Tipo de seleção</span>
                    <select value={selData?.randomMode ?? 'random'} onChange={(e) => updateData(selected.id, { randomMode: e.target.value as 'random' | 'sequential' })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm">
                      <option value="random">🎲 Aleatório (sorteio)</option>
                      <option value="sequential">🔁 Sequencial (um por um, em rodízio)</option>
                    </select>
                  </label>
                  <span className="mt-3 block text-xs font-medium text-gray-500">Caminhos</span>
                  <p className="mt-1 text-[11px] text-gray-400">No aleatório, cai num por sorteio. No sequencial, roda um a um em ordem (bom pra distribuir entre atendentes/mensagens).</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => updateData(selected.id, { branches: [...(selData?.branches ?? []), { id: crypto.randomUUID().slice(0, 6) }] })} className="text-sm font-medium text-fuchsia-600 hover:underline">+ caminho</button>
                    <button onClick={() => { const b = selData?.branches ?? []; if (b.length <= 1) return; const last = b[b.length - 1]; updateData(selected.id, { branches: b.slice(0, -1) }); removeHandleEdges(selected.id, `br-${last.id}`) }} className="text-sm text-gray-400 hover:text-red-500">− remover</button>
                  </div>
                </div>
              )}

              {selType === 'delay' && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Segundos de espera (mostra “digitando…”)</span>
                  <input type="number" min={1} max={30} value={selData?.seconds ?? 2} onChange={(e) => updateData(selected.id, { seconds: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-slate-500" />
                </label>
              )}

              {selType === 'flowjump' && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Ir para o fluxo…</span>
                  <select value={selData?.flowId ?? ''} onChange={(e) => { const f = allFlows.find((x) => x.id === e.target.value); updateData(selected.id, { flowId: e.target.value, flowName: f?.name ?? '' }) }} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm">
                    <option value="">— escolha —</option>
                    {allFlows.filter((f) => f.id !== flowId).map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">Pula a conversa para o começo de outro fluxo.</p>
                </label>
              )}

              {selType === 'integration' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">URL (webhook / API)</span>
                    <input value={selData?.url ?? ''} onChange={(e) => updateData(selected.id, { url: e.target.value })} placeholder="https://…" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-teal-500" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Método</span>
                    <select value={selData?.method ?? 'GET'} onChange={(e) => updateData(selected.id, { method: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm">
                      <option>GET</option>
                      <option>POST</option>
                    </select>
                  </label>
                  <p className="text-[11px] text-amber-600">⚠️ Experimental: a chamada real acontece quando ligarmos no WhatsApp.</p>
                </>
              )}

              {selType === 'image' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">URL da imagem</span>
                    <input value={selData?.imageUrl ?? ''} onChange={(e) => updateData(selected.id, { imageUrl: e.target.value })} placeholder="https://…/foto.jpg" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-pink-500" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Legenda (opcional)</span>
                    <input value={selData?.caption ?? ''} onChange={(e) => updateData(selected.id, { caption: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-pink-500" />
                  </label>
                  {selData?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selData.imageUrl} alt="prévia" className="mt-1 max-h-40 rounded-lg border border-gray-200 object-contain" />
                  ) : (
                    <p className="text-[11px] text-gray-400">Cole o link de uma imagem pública (ou faça upload no Supabase Storage e cole a URL).</p>
                  )}
                </>
              )}

              {(selType === 'video' || selType === 'file' || selType === 'audio') && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">📤 Enviar arquivo (fica hospedado sozinho)</span>
                    <input
                      type="file"
                      accept={selType === 'video' ? 'video/*' : selType === 'audio' ? 'audio/*' : undefined}
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        updateData(selected.id, { mediaUrl: '' })
                        const fd = new FormData(); fd.append('file', f)
                        const r = await fetch('/api/upload', { method: 'POST', body: fd })
                        const d = await r.json().catch(() => ({}))
                        if (d.url) updateData(selected.id, selType === 'file' ? { mediaUrl: d.url, fileName: d.name } : { mediaUrl: d.url })
                        else alert('Falha no upload: ' + (d.error || 'erro'))
                      }}
                      className="mt-1 w-full text-xs text-gray-600"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">…ou cole a URL</span>
                    <input value={selData?.mediaUrl ?? ''} onChange={(e) => updateData(selected.id, { mediaUrl: e.target.value })} placeholder="https://…" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
                  </label>
                  {selType === 'file' && (
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500">Nome do arquivo (opcional)</span>
                      <input value={selData?.fileName ?? ''} onChange={(e) => updateData(selected.id, { fileName: e.target.value })} placeholder="ex: preparo-do-exame.pdf" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
                    </label>
                  )}
                  {(selType === 'video' || selType === 'file') && (
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500">Legenda (opcional)</span>
                      <input value={selData?.caption ?? ''} onChange={(e) => updateData(selected.id, { caption: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
                    </label>
                  )}
                  {selData?.mediaUrl && <p className="break-all text-[11px] text-emerald-600">✅ pronto: …{selData.mediaUrl.slice(-40)}</p>}
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
