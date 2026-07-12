'use client'

import { useEffect, useState } from 'react'

type QR = { id: string; shortcut: string; text: string }

export default function QuickRepliesPanel() {
  const [items, setItems] = useState<QR[]>([])
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [shortcut, setShortcut] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() { setItems(await (await fetch('/api/quick-replies')).json()) }
  useEffect(() => { load() }, [])

  async function criar() {
    if (!shortcut.trim() || !text.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/quick-replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shortcut, text }) })
      if (r.ok) { setOpen(false); setShortcut(''); setText(''); load() }
    } finally { setBusy(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta resposta rápida?')) return
    await fetch(`/api/quick-replies?id=${id}`, { method: 'DELETE' })
    load()
  }

  const filtradas = items.filter((i) => i.shortcut.toLowerCase().includes(busca.toLowerCase()) || i.text.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Mensagens prontas. No inbox, digite <code className="rounded bg-gray-100 px-1">/atalho</code> pra usar.</p>
        <div className="flex items-center gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500" />
          <button onClick={() => setOpen(true)} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Criar</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400"><th className="w-48 px-4 py-3 font-medium">Nome (/atalho)</th><th className="px-4 py-3 font-medium">Responder</th><th className="px-4 py-3" /></tr></thead>
          <tbody>
            {filtradas.map((i) => (
              <tr key={i.id} className="border-b border-gray-50 last:border-0 align-top">
                <td className="px-4 py-3"><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">/{i.shortcut}</code></td>
                <td className="px-4 py-3 text-gray-600"><div className="line-clamp-2">{i.text}</div></td>
                <td className="px-4 py-3 text-right"><button onClick={() => excluir(i.id)} className="text-xs text-red-500 hover:underline">excluir</button></td>
              </tr>
            ))}
            {filtradas.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma resposta rápida.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Criar resposta rápida</h3><button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nome (atalho — sem a barra)</label>
            <input value={shortcut} onChange={(e) => setShortcut(e.target.value.replace(/\s/g, ''))} placeholder="ex: prontuario" autoFocus className="mb-3 w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
            <label className="mb-1 block text-xs font-medium text-gray-500">Responder</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem que será enviada…" rows={5} className="mb-5 w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
              <button onClick={criar} disabled={busy || !shortcut.trim() || !text.trim()} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? 'criando…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
