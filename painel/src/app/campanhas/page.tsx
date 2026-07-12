'use client'

import { useCallback, useEffect, useState } from 'react'

type Campaign = { id: string; name: string; flow_id: string | null; phrase: string; participants: number; executions: number }
type Flow = { id: string; name: string }

export default function Campanhas() {
  const [items, setItems] = useState<Campaign[]>([])
  const [flows, setFlows] = useState<Flow[]>([])
  const [phone, setPhone] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | Campaign | 'new'>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [c, f, s] = await Promise.all([
      fetch('/api/campaigns').then((r) => r.json()).catch(() => []),
      fetch('/api/flows').then((r) => r.json()).catch(() => []),
      fetch('/api/status').then((r) => r.json()).catch(() => ({})),
    ])
    setItems(Array.isArray(c) ? c : [])
    setFlows(Array.isArray(f) ? f.map((x: Flow) => ({ id: x.id, name: x.name })) : [])
    setPhone(s?.me ?? null)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  function linkDe(phrase: string) {
    if (!phone) return ''
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(phrase)}`
  }
  async function copiar(c: Campaign) {
    const link = linkDe(c.phrase)
    if (!link) { alert('WhatsApp não conectado — não dá pra gerar o link ainda.'); return }
    try { await navigator.clipboard.writeText(link) } catch {}
    setCopied(c.id); setTimeout(() => setCopied((x) => (x === c.id ? null : x)), 1500)
  }
  async function excluir(c: Campaign) {
    setMenu(null)
    if (!confirm(`Excluir a campanha "${c.name}"?`)) return
    await fetch(`/api/campaigns?id=${c.id}`, { method: 'DELETE' }); load()
  }

  const filtered = items.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()) || c.phrase.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500">Anúncios (Google/Meta): a frase do link dispara o fluxo certo, sem menu.</p>
        </div>
        <button onClick={() => setModal('new')} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600">Criar Nova Campanha +</button>
      </header>

      {!phone && !loading && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">⚠️ WhatsApp não conectado — os links só são gerados com o número conectado (Config → Conexão).</div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">Todas as campanhas <span className="font-semibold text-gray-700">{items.length}</span></div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-56 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white" />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">carregando…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                <th className="px-4 py-3">Campanha</th>
                <th className="px-4 py-3 text-center">Participantes</th>
                <th className="px-4 py-3 text-center">Execuções</th>
                <th className="px-4 py-3 text-center">CTR, %</th>
                <th className="px-4 py-3" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400">💬 “{c.phrase}” → {flows.find((f) => f.id === c.flow_id)?.name || <span className="text-red-400">fluxo removido</span>}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{c.participants || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{c.executions || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{c.participants ? Math.round(((c.executions || 0) / c.participants) * 100) + '%' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => copiar(c)} className="rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-100">{copied === c.id ? '✓ copiado!' : '🔗 Copiar Link'}</button>
                  </td>
                  <td className="relative px-4 py-3 text-right">
                    <button onClick={() => setMenu(menu === c.id ? null : c.id)} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100">⋮</button>
                    {menu === c.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                        <div className="absolute right-4 z-20 mt-1 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                          <button onClick={() => { setModal(c); setMenu(null) }} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">✏️ Editar</button>
                          <button onClick={() => excluir(c)} className="block w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50">🗑 Excluir</button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Nenhuma campanha ainda. Crie a primeira!</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && <CampaignModal campaign={modal === 'new' ? null : modal} flows={flows} phone={phone} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </main>
  )
}

function CampaignModal({ campaign, flows, phone, onClose, onSaved }: { campaign: Campaign | null; flows: Flow[]; phone: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(campaign?.name || '')
  const [flowId, setFlowId] = useState(campaign?.flow_id || '')
  const [phrase, setPhrase] = useState(campaign?.phrase || '')
  const [busy, setBusy] = useState(false)

  const link = phone && phrase.trim() ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(phrase.trim())}` : ''

  async function salvar() {
    if (!name.trim() || !phrase.trim() || !flowId) return
    setBusy(true)
    try {
      if (campaign) await fetch('/api/campaigns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campaign.id, name, flowId, phrase }) })
      else await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, flowId, phrase }) })
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">{campaign ? 'Editar campanha' : 'Criar nova campanha'}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button></div>

        <label className="block text-sm font-medium text-gray-700">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Check-up ginecologia (Meta)" className="mb-3 mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />

        <label className="block text-sm font-medium text-gray-700">Fluxo que vai disparar</label>
        <select value={flowId} onChange={(e) => setFlowId(e.target.value)} className="mb-3 mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:border-emerald-500">
          <option value="">— selecione —</option>
          {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <label className="block text-sm font-medium text-gray-700">Frase que inicia (vem preenchida no WhatsApp)</label>
        <input value={phrase} onChange={(e) => setPhrase(e.target.value.replace(/[.!?]+$/, ''))} placeholder="Ex: olá quero saber mais sobre check-up" className="mb-1 mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
        <p className="mb-3 text-xs text-gray-400">Não termine com ponto (.), exclamação (!) ou interrogação (?).</p>

        {link && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="mb-1 text-xs font-semibold text-emerald-700">🔗 Link gerado (use no anúncio):</div>
            <div className="break-all font-mono text-[11px] text-emerald-800">{link}</div>
          </div>
        )}
        {!phone && <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">⚠️ Conecte o WhatsApp pra o link ser gerado.</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={salvar} disabled={busy || !name.trim() || !phrase.trim() || !flowId} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? 'salvando…' : campaign ? 'Salvar' : 'Criar Campanha'}</button>
        </div>
      </div>
    </div>
  )
}
