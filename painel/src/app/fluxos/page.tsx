'use client'

import { useCallback, useEffect, useState } from 'react'

type FlowItem = { id: string; name: string; is_active: boolean; updated_at: string; folder_id: string | null }
type Folder = { id: string; name: string; count: number }
type Settings = { default_flow_id: string | null; media_flow_id: string | null }

export default function Fluxos() {
  const [flows, setFlows] = useState<FlowItem[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [settings, setSettings] = useState<Settings>({ default_flow_id: null, media_flow_id: null })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [curFolder, setCurFolder] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [moveMenu, setMoveMenu] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [f, fo, s] = await Promise.all([
      fetch('/api/flows').then((r) => r.json()),
      fetch('/api/flow-folders').then((r) => r.json()).catch(() => []),
      fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
    ])
    setFlows(f); setFolders(Array.isArray(fo) ? fo : [])
    setSettings({ default_flow_id: s?.default_flow_id ?? null, media_flow_id: s?.media_flow_id ?? null })
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function criar() {
    const name = prompt('Nome do novo fluxo:')?.trim()
    if (!name) return
    const res = await fetch('/api/flows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await res.json()
    if (data.id) {
      if (curFolder) await fetch(`/api/flows/${data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', folderId: curFolder }) })
      window.location.href = `/construtor?id=${data.id}`
    }
  }
  async function criarPasta() {
    const name = prompt('Nome da nova pasta (ex.: Valores consulta, Exames):')?.trim()
    if (!name) return
    await fetch('/api/flow-folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    load()
  }
  async function excluirPasta(f: Folder) {
    if (!confirm(`Excluir a pasta "${f.name}"? Os fluxos dentro dela voltam pra raiz.`)) return
    await fetch(`/api/flow-folders?id=${f.id}`, { method: 'DELETE' }); load()
  }
  async function flowAction(id: string, body: object) {
    await fetch(`/api/flows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setMenu(null); setMoveMenu(null); load()
  }
  async function renomear(id: string, atual: string) {
    const name = prompt('Novo nome:', atual)?.trim(); if (!name) return
    flowAction(id, { action: 'rename', name })
  }
  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o fluxo "${nome}"?`)) return
    await fetch(`/api/flows/${id}`, { method: 'DELETE' }); setMenu(null); load()
  }
  async function moverPara(id: string, folderId: string | null) { flowAction(id, { action: 'move', folderId }) }
  async function salvarSetting(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }))
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  }

  const welcomeId = flows.find((f) => f.is_active)?.id ?? ''
  const q = search.trim().toLowerCase()
  const visible = flows.filter((f) => (f.folder_id ?? null) === curFolder && f.name.toLowerCase().includes(q))
  const folderName = folders.find((f) => f.id === curFolder)?.name

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900">Fluxos de conversa</h1>
          <p className="text-sm text-gray-500">Seus chatbots, organizados em pastas.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={criarPasta} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Criar Pasta 📁</button>
          <button onClick={criar} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600">Criar Novo Fluxo +</button>
        </div>
      </header>

      {/* FLUXOS PADRÕES BÁSICOS */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-600">Fluxos Padrões Básicos</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <BaseFlowCard icon="👋" title="Fluxo de boas-vindas" hint="Enviado só a contatos novos, 1x." flows={flows} value={welcomeId} onChange={(id) => flowAction(id, { action: 'activate' })} />
          <BaseFlowCard icon="💬" title="Fluxo de resposta padrão" hint="Quando um contato já concluído volta a escrever." flows={flows} value={settings.default_flow_id ?? ''} onChange={(id) => salvarSetting({ default_flow_id: id || null })} allowNone />
          <BaseFlowCard icon="🖼️" title="Fluxo padrão para mídia" hint="Quando o contato envia foto, vídeo ou arquivo." flows={flows} value={settings.media_flow_id ?? ''} onChange={(id) => salvarSetting({ media_flow_id: id || null })} allowNone />
        </div>
      </section>

      {/* BREADCRUMB + BUSCA */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          <button onClick={() => setCurFolder(null)} className={curFolder ? 'text-emerald-600 hover:underline' : 'font-semibold text-gray-700'}>Todos os Fluxos</button>
          {folderName && <span className="text-gray-700"> / <b>{folderName}</b></span>}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-56 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white" />
      </div>

      {/* PASTAS (só na raiz, sem busca) */}
      {!curFolder && !q && folders.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm">
              <button onClick={() => setCurFolder(f.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="text-xl">📁</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{f.name}</span>
                <span className="text-xs text-gray-400">{f.count}</span>
              </button>
              <button onClick={() => excluirPasta(f)} className="text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500" title="Excluir pasta">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* TABELA DE FLUXOS */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">carregando…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 text-center">Connections</th>
                <th className="px-4 py-3 text-center">Execuções</th>
                <th className="px-4 py-3 text-center">CTR, %</th>
                <th className="px-4 py-3">Última alteração</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <a href={`/construtor?id=${f.id}`} className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 hover:text-emerald-600">{f.name}</span>
                      {f.is_active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">boas-vindas</span>}
                      {settings.default_flow_id === f.id && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">resposta</span>}
                      {settings.media_flow_id === f.id && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">mídia</span>}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">—</td>
                  <td className="px-4 py-3 text-center text-gray-300">—</td>
                  <td className="px-4 py-3 text-center text-gray-300">—</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(f.updated_at).toLocaleDateString('pt-BR')}</td>
                  <td className="relative px-4 py-3 text-right">
                    <button onClick={() => { setMenu(menu === f.id ? null : f.id); setMoveMenu(null) }} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100">⋮</button>
                    {menu === f.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => { setMenu(null); setMoveMenu(null) }} />
                        <div className="absolute right-4 z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-xl">
                          <a href={`/construtor?id=${f.id}`} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">✏️ Editar fluxo</a>
                          {!f.is_active && <button onClick={() => flowAction(f.id, { action: 'activate' })} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">👋 Definir como boas-vindas</button>}
                          <button onClick={() => setMoveMenu(moveMenu === f.id ? null : f.id)} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">📁 Mover para…</button>
                          {moveMenu === f.id && (
                            <div className="max-h-44 overflow-y-auto border-y border-gray-100 bg-gray-50">
                              {(f.folder_id ?? null) !== null && <button onClick={() => moverPara(f.id, null)} className="block w-full px-5 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-100">↑ Raiz (sem pasta)</button>}
                              {folders.filter((fo) => fo.id !== f.folder_id).map((fo) => (
                                <button key={fo.id} onClick={() => moverPara(f.id, fo.id)} className="block w-full px-5 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-100">📁 {fo.name}</button>
                              ))}
                              {folders.length === 0 && <div className="px-5 py-1.5 text-xs text-gray-400">crie uma pasta primeiro</div>}
                            </div>
                          )}
                          <button onClick={() => renomear(f.id, f.name)} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">🔤 Renomear</button>
                          <button onClick={() => excluir(f.id, f.name)} className="block w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50">🗑 Excluir</button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">{q ? 'Nenhum fluxo encontrado.' : curFolder ? 'Pasta vazia. Mova fluxos pra cá pelo menu ⋮.' : 'Nenhum fluxo ainda.'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function BaseFlowCard({ icon, title, hint, flows, value, onChange, allowNone }: {
  icon: string; title: string; hint: string
  flows: FlowItem[]; value: string; onChange: (id: string) => void; allowNone?: boolean
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2"><span className="text-lg">{icon}</span><span className="text-sm font-bold text-gray-800">{title}</span></div>
      <p className="mb-3 text-xs text-gray-400">{hint}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:bg-white">
        {allowNone && <option value="">— nenhum —</option>}
        {!allowNone && !value && <option value="">— selecione —</option>}
        {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  )
}
