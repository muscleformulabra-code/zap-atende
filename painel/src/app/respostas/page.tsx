'use client'

import { useEffect, useState } from 'react'

type QR = { id: string; shortcut: string; text: string }

export default function Respostas() {
  const [items, setItems] = useState<QR[]>([])
  const [shortcut, setShortcut] = useState('')
  const [text, setText] = useState('')
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    setItems(await (await fetch('/api/quick-replies')).json())
  }
  useEffect(() => {
    load()
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    const r = await fetch('/api/quick-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcut, text }),
    })
    const d = await r.json()
    if (!r.ok) return setMsg('❌ ' + (d.error || 'erro (a tabela já foi criada no Supabase?)'))
    setShortcut(''); setText(''); setMsg('✅ criada')
    load()
  }

  async function remover(id: string) {
    if (!confirm('Remover esta resposta rápida?')) return
    await fetch(`/api/quick-replies?id=${id}`, { method: 'DELETE' })
    load()
  }

  const filtered = items.filter(
    (i) => i.shortcut.toLowerCase().includes(busca.toLowerCase()) || i.text.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Respostas rápidas</h1>
        <p className="text-sm text-gray-500">Mensagens prontas. No inbox, digite <code className="rounded bg-gray-100 px-1">/atalho</code> pra usar.</p>
      </header>

      <form onSubmit={criar} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="font-medium text-gray-800">Nova resposta</div>
        <div className="mt-3 flex flex-col gap-2">
          <label>
            <span className="text-xs text-gray-500">Atalho (sem espaço) — ex: prontuario</span>
            <input value={shortcut} onChange={(e) => setShortcut(e.target.value)} required placeholder="prontuario" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label>
            <span className="text-xs text-gray-500">Mensagem</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} required rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <div className="flex items-center gap-3">
            <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Criar</button>
            {msg && <span className="text-sm text-gray-600">{msg}</span>}
          </div>
        </div>
      </form>

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filtered.map((i) => (
          <div key={i.id} className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
            <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 font-mono text-xs text-emerald-700">/{i.shortcut}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{i.text}</span>
            <button onClick={() => remover(i.id)} className="text-sm text-red-500 hover:underline">remover</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Nenhuma resposta rápida. {items.length === 0 && '(Se acabou de criar a tabela no Supabase, recarregue.)'}
          </div>
        )}
      </div>
    </main>
  )
}
