'use client'

import { useCallback, useEffect, useState } from 'react'

type FlowItem = { id: string; name: string; is_active: boolean; updated_at: string }
type Settings = { default_flow_id: string | null; media_flow_id: string | null }

export default function Fluxos() {
  const [flows, setFlows] = useState<FlowItem[]>([])
  const [settings, setSettings] = useState<Settings>({ default_flow_id: null, media_flow_id: null })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedMsg, setSavedMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [f, s] = await Promise.all([
      fetch('/api/flows').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
    ])
    setFlows(f)
    setSettings({ default_flow_id: s?.default_flow_id ?? null, media_flow_id: s?.media_flow_id ?? null })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setSavedMsg(m); setTimeout(() => setSavedMsg(''), 2000) }

  async function criar() {
    const name = prompt('Nome do novo fluxo:')?.trim()
    if (!name) return
    const res = await fetch('/api/flows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await res.json()
    if (data.id) window.location.href = `/construtor?id=${data.id}`
  }

  async function definirBoasVindas(id: string) {
    if (!id) return
    await fetch(`/api/flows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'activate' }) })
    flash('✅ Fluxo de boas-vindas atualizado'); load()
  }

  async function salvarSetting(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }))
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    flash('✅ Fluxo padrão salvo')
  }

  async function ativar(id: string) { await definirBoasVindas(id) }
  async function renomear(id: string, atual: string) {
    const name = prompt('Novo nome:', atual)?.trim()
    if (!name) return
    await fetch(`/api/flows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rename', name }) })
    load()
  }
  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o fluxo "${nome}"? Isso não pode ser desfeito.`)) return
    await fetch(`/api/flows/${id}`, { method: 'DELETE' })
    load()
  }

  const welcomeId = flows.find((f) => f.is_active)?.id ?? ''
  const filtered = flows.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 pr-12">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900">Fluxos de conversa</h1>
          <p className="text-sm text-gray-500">Seus chatbots e os fluxos base que o robô usa automaticamente.</p>
        </div>
        <button onClick={criar} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600">
          Criar Novo Fluxo
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </header>

      {/* FLUXOS PADRÕES BÁSICOS */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-600">Fluxos Padrões Básicos</h2>
          {savedMsg && <span className="text-xs font-medium text-emerald-500">{savedMsg}</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <BaseFlowCard
            icon="👋" title="Fluxo de boas-vindas"
            hint="Enviado só a contatos novos, 1x."
            flows={flows} value={welcomeId} onChange={definirBoasVindas}
          />
          <BaseFlowCard
            icon="💬" title="Fluxo de resposta padrão"
            hint="Quando um contato já concluído volta a escrever."
            flows={flows} value={settings.default_flow_id ?? ''} onChange={(id) => salvarSetting({ default_flow_id: id || null })} allowNone
          />
          <BaseFlowCard
            icon="🖼️" title="Fluxo padrão para mídia"
            hint="Quando o contato envia foto, vídeo ou arquivo."
            flows={flows} value={settings.media_flow_id ?? ''} onChange={(id) => salvarSetting({ media_flow_id: id || null })} allowNone
          />
        </div>
      </section>

      {/* TODOS OS FLUXOS */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Todos os Fluxos</h2>
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fluxo…" className="w-56 rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white" />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">carregando…</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {filtered.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-gray-50/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-gray-800">{f.name}</span>
                    {f.is_active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">boas-vindas</span>}
                    {settings.default_flow_id === f.id && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">resposta padrão</span>}
                    {settings.media_flow_id === f.id && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">mídia</span>}
                  </div>
                  <div className="text-xs text-gray-400">atualizado {new Date(f.updated_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <a href={`/construtor?id=${f.id}`} className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">editar</a>
                {!f.is_active && <button onClick={() => ativar(f.id)} className="text-sm font-medium text-emerald-600 hover:underline">boas-vindas</button>}
                <button onClick={() => renomear(f.id, f.name)} className="text-sm text-gray-500 hover:underline">renomear</button>
                <button onClick={() => excluir(f.id, f.name)} className="text-sm text-red-500 hover:underline">excluir</button>
              </div>
            ))}
            {filtered.length === 0 && <div className="px-4 py-12 text-center text-sm text-gray-400">{search ? 'Nenhum fluxo encontrado.' : 'Nenhum fluxo ainda.'}</div>}
          </div>
        )}
      </section>
    </main>
  )
}

function BaseFlowCard({ icon, title, hint, flows, value, onChange, allowNone }: {
  icon: string; title: string; hint: string
  flows: FlowItem[]; value: string; onChange: (id: string) => void; allowNone?: boolean
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-bold text-gray-800">{title}</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">{hint}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:bg-white">
        {allowNone && <option value="">— nenhum —</option>}
        {!allowNone && !value && <option value="">— selecione —</option>}
        {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  )
}
