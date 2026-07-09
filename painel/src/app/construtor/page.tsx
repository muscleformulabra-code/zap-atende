'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
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

const NODE_W = 240
const HEADER_H = 30
const TEXT_H = 44
const ROW_H = 30

const HEAD: Record<BlockType, string> = {
  message: 'text-emerald-600',
  menu: 'text-indigo-600',
  handoff: 'text-amber-600',
  action: 'text-yellow-600',
  condition: 'text-sky-600',
  randomizer: 'text-fuchsia-600',
  delay: 'text-slate-600',
  flowjump: 'text-rose-600',
  integration: 'text-teal-600',
  image: 'text-pink-600',
}

function card(selected?: boolean) {
  return `rounded-xl border bg-white text-xs shadow-sm ${selected ? 'border-gray-800 ring-2 ring-gray-300' : 'border-gray-200'}`
}

function Header({ type }: { type: BlockType }) {
  const m = blockMeta(type)
  return <div className={`border-b border-gray-100 px-3 py-1.5 font-semibold ${HEAD[type]}`}>{m.emoji} {m.label}</div>
}

function bodyText(t: BlockType, d: NodeData): string {
  switch (t) {
    case 'message': return d.text || 'sem texto'
    case 'delay': return `Espera ${d.seconds ?? 2}s (digitando…)`
    case 'integration': return d.url || 'URL não configurada'
    case 'image': return d.imageUrl ? `🖼️ ${d.caption || 'imagem'}` : '🖼️ imagem (sem URL)'
    case 'handoff': return d.text || 'passa pro atendente humano'
    case 'action': return d.action === 'end' ? 'Encerrar conversa' : 'Reiniciar fluxo'
    case 'flowjump': return d.flowName ? `→ ${d.flowName}` : 'escolha um fluxo'
    default: return ''
  }
}

// Blocos com uma única saída ("próximo") — e os terminais (sem saída).
function SimpleNode({ type, data, selected }: NodeProps) {
  const t = type as BlockType
  const d = data as NodeData
  const hasNext = t === 'message' || t === 'delay' || t === 'integration' || t === 'image'
  return (
    <div className={card(selected)} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Left} />
      <Header type={t} />
      <div className="whitespace-pre-wrap px-3 py-2 text-gray-600">{bodyText(t, d)}</div>
      {hasNext && <Handle type="source" position={Position.Right} />}
    </div>
  )
}

function MenuNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  const options = d.options ?? []
  return (
    <div className={card(selected)} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Left} />
      <Header type="menu" />
      <div className="overflow-hidden px-3 py-1 text-gray-600" style={{ height: TEXT_H }}>{d.text || 'sem pergunta'}</div>
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center border-t border-gray-50 px-3 text-gray-700" style={{ height: ROW_H }}>
          <span className="truncate">{i + 1}. {o.label}</span>
          <Handle type="source" id={`opt-${o.id}`} position={Position.Right} style={{ top: HEADER_H + TEXT_H + i * ROW_H + ROW_H / 2 }} />
        </div>
      ))}
    </div>
  )
}

function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  const info = 34
  return (
    <div className={card(selected)} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Left} />
      <Header type="condition" />
      <div className="overflow-hidden px-3 py-1 text-gray-600" style={{ height: info }}>Se contém: “{d.keyword || '—'}”</div>
      <div className="flex items-center border-t border-gray-50 px-3 text-emerald-700" style={{ height: ROW_H }}>
        <span>✅ sim</span>
        <Handle type="source" id="yes" position={Position.Right} style={{ top: HEADER_H + info + ROW_H / 2 }} />
      </div>
      <div className="flex items-center border-t border-gray-50 px-3 text-rose-600" style={{ height: ROW_H }}>
        <span>🚫 não</span>
        <Handle type="source" id="no" position={Position.Right} style={{ top: HEADER_H + info + ROW_H + ROW_H / 2 }} />
      </div>
    </div>
  )
}

function RandomizerNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  const branches = d.branches ?? []
  const info = 28
  return (
    <div className={card(selected)} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Left} />
      <Header type="randomizer" />
      <div className="px-3 py-1 text-gray-500" style={{ height: info }}>Divide aleatoriamente:</div>
      {branches.map((b, i) => (
        <div key={b.id} className="flex items-center border-t border-gray-50 px-3 text-gray-700" style={{ height: ROW_H }}>
          <span>🎲 Caminho {i + 1}</span>
          <Handle type="source" id={`br-${b.id}`} position={Position.Right} style={{ top: HEADER_H + info + i * ROW_H + ROW_H / 2 }} />
        </div>
      ))}
    </div>
  )
}

const nodeTypes = {
  message: SimpleNode,
  delay: SimpleNode,
  integration: SimpleNode,
  image: SimpleNode,
  handoff: SimpleNode,
  action: SimpleNode,
  flowjump: SimpleNode,
  menu: MenuNode,
  condition: ConditionNode,
  randomizer: RandomizerNode,
}

const PALETTE: BlockType[] = ['message', 'image', 'menu', 'condition', 'action', 'delay', 'randomizer', 'flowjump', 'handoff', 'integration']

type FlowItem = { id: string; name: string; is_active: boolean }

export default function Construtor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [flowId, setFlowId] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('')
  const [allFlows, setAllFlows] = useState<FlowItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPalette, setShowPalette] = useState(false)
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
    setNodes((ns) => [...ns, { id, type, position: { x: 180 + Math.random() * 140, y: 120 + Math.random() * 160 }, data: newBlockData(type) }])
    setSelectedId(id)
    setShowPalette(false)
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <a href="/fluxos" className="text-sm text-gray-400 hover:text-gray-700">← fluxos</a>
        <h1 className="font-bold text-gray-900">{flowName || 'Construtor'}</h1>
        <div className="relative">
          <button onClick={() => setShowPalette((s) => !s)} className="rounded-lg bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-700">
            + Bloco
          </button>
          {showPalette && (
            <div className="absolute left-0 top-9 z-10 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
              {PALETTE.map((t) => {
                const m = blockMeta(t)
                return (
                  <button key={t} onClick={() => addBlock(t)} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-gray-50">
                    <span>{m.emoji}</span>
                    <span className={HEAD[t]}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a href="/simulador" target="_blank" className="text-sm font-medium text-gray-500 hover:text-gray-800">testar ↗</a>
          <button onClick={save} disabled={status === 'saving' || !flowId} className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
            {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="h-full flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => { setSelectedId(null); setShowPalette(false) }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>

        <aside className="w-80 overflow-y-auto border-l border-gray-200 bg-white p-4">
          {!selected && (
            <div className="text-sm text-gray-400">
              <p className="mb-2 font-medium text-gray-600">Editando: {flowName || '—'}</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Use <b>+ Bloco</b> pra adicionar.</li>
                <li>Ligue arrastando da bolinha da direita à esquerda do próximo bloco.</li>
                <li>Clique num bloco pra editar aqui.</li>
                <li><b>Salvar</b> e <b>testar</b> no simulador.</li>
              </ul>
              <p className="mt-3 text-xs">O bloco sem seta chegando é o <b>início</b>.</p>
            </div>
          )}

          {selected && selType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{blockMeta(selType).emoji} {blockMeta(selType).label}</span>
                <button onClick={() => removeNode(selected.id)} className="text-xs font-medium text-red-500 hover:underline">excluir</button>
              </div>

              {(selType === 'message' || selType === 'handoff') && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">Texto</span>
                  <textarea value={selData?.text ?? ''} onChange={(e) => updateData(selected.id, { text: e.target.value })} rows={4} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
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
                      {menuOptions.map((o) => {
                        const connected = edges.some((e) => e.source === selected.id && e.sourceHandle === `opt-${o.id}`)
                        return (
                          <div key={o.id} className="flex items-center gap-2">
                            <input value={o.label} onChange={(e) => updateData(selected.id, { options: menuOptions.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })} className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500" />
                            <span title={connected ? 'ligada' : 'sem destino'} className={connected ? 'text-emerald-500' : 'text-gray-300'}>●</span>
                            <button onClick={() => { updateData(selected.id, { options: menuOptions.filter((x) => x.id !== o.id) }); removeHandleEdges(selected.id, `opt-${o.id}`) }} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => updateData(selected.id, { options: [...menuOptions, { id: crypto.randomUUID().slice(0, 6), label: `Opção ${menuOptions.length + 1}` } as MenuOption] })} className="mt-2 text-sm font-medium text-indigo-600 hover:underline">+ adicionar opção</button>
                  </div>
                </>
              )}

              {selType === 'action' && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">O que fazer</span>
                  <select value={selData?.action ?? 'restart'} onChange={(e) => updateData(selected.id, { action: e.target.value as 'restart' | 'end' })} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm">
                    <option value="restart">Reiniciar o fluxo</option>
                    <option value="end">Encerrar a conversa</option>
                  </select>
                </label>
              )}

              {selType === 'condition' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Se a mensagem contém…</span>
                    <input value={selData?.keyword ?? ''} onChange={(e) => updateData(selected.id, { keyword: e.target.value })} placeholder="ex: convênio" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-sky-500" />
                  </label>
                  <p className="text-[11px] text-gray-400">Saída <b className="text-emerald-600">✅ sim</b> se conter a palavra; <b className="text-rose-600">🚫 não</b> caso contrário. Ligue as duas no canvas.</p>
                </>
              )}

              {selType === 'randomizer' && (
                <div>
                  <span className="text-xs font-medium text-gray-500">Caminhos aleatórios</span>
                  <p className="mt-1 text-[11px] text-gray-400">O contato cai num deles por sorteio (bom pra testar mensagens).</p>
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
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
