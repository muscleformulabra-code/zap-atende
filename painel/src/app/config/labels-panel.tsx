'use client'

import { useEffect, useState } from 'react'

type Label = { id: string; name: string; description: string | null; color: string }

const COLORS: Record<string, { chip: string; dot: string; label: string }> = {
  gray: { chip: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: 'Cinza' },
  green: { chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Verde' },
  red: { chip: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Vermelho' },
  yellow: { chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Amarelo' },
  blue: { chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'Azul' },
  violet: { chip: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', label: 'Violeta' },
  pink: { chip: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500', label: 'Rosa' },
  teal: { chip: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500', label: 'Azul esverdeado' },
}

export default function LabelsPanel() {
  const [labels, setLabels] = useState<Label[]>([])
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState('gray')
  const [busy, setBusy] = useState(false)

  async function load() { setLabels(await (await fetch('/api/labels')).json()) }
  useEffect(() => { load() }, [])

  async function criar() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc, color }) })
      if (r.ok) { setOpen(false); setName(''); setDesc(''); setColor('gray'); load() }
    } finally { setBusy(false) }
  }

  async function excluir(l: Label) {
    if (!confirm(`Excluir a etiqueta "${l.name}"?`)) return
    await fetch(`/api/labels?id=${l.id}`, { method: 'DELETE' })
    load()
  }

  const filtradas = labels.filter((l) => l.name.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500">Todas etiquetas <span className="font-semibold text-gray-700">{labels.length}</span></div>
        <div className="flex items-center gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500" />
          <button onClick={() => setOpen(true)} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Criar</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400"><th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">Descrição</th><th className="px-4 py-3" /></tr></thead>
          <tbody>
            {filtradas.map((l) => {
              const c = COLORS[l.color] || COLORS.gray
              return (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${c.chip}`}><span className={`h-2 w-2 rounded-full ${c.dot}`} />{l.name}</span></td>
                  <td className="px-4 py-3 text-gray-500">{l.description || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => excluir(l)} className="text-xs text-red-500 hover:underline">excluir</button></td>
                </tr>
              )
            })}
            {filtradas.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma etiqueta.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Criar nova etiqueta</h3><button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" autoFocus className="mb-3 w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (opcional)" rows={3} className="mb-3 w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
            <div className="mb-1 text-xs font-medium text-gray-500">Cor</div>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {Object.entries(COLORS).map(([k, c]) => (
                <button key={k} onClick={() => setColor(k)} className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${c.chip} ${color === k ? 'ring-2 ring-emerald-500 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}>{c.label}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
              <button onClick={criar} disabled={busy || !name.trim()} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? 'criando…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
