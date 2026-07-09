'use client'

import { useEffect, useState } from 'react'

type User = { id: string; email: string; created_at: string }

export default function Equipe() {
  const [users, setUsers] = useState<User[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    setUsers(await (await fetch('/api/team')).json())
  }
  useEffect(() => {
    load()
  }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    const r = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const d = await r.json()
    if (!r.ok) return setMsg('❌ ' + (d.error || 'erro'))
    setEmail(''); setPassword(''); setMsg('✅ atendente criado')
    load()
  }

  async function remover(id: string, email: string) {
    if (!confirm(`Remover o acesso de ${email}?`)) return
    await fetch(`/api/team?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500">Atendentes com acesso ao painel</p>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-800">← painel</a>
      </header>

      <form onSubmit={criar} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="font-medium text-gray-800">Adicionar atendente</div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="text-xs text-gray-500">E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-500">Senha (mín. 6)</span>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Criar</button>
        </div>
        {msg && <div className="mt-2 text-sm text-gray-600">{msg}</div>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
              {u.email.slice(0, 2).toUpperCase()}
            </div>
            <span className="flex-1 text-sm text-gray-800">{u.email}</span>
            <button onClick={() => remover(u.id, u.email)} className="text-sm text-red-500 hover:underline">remover</button>
          </div>
        ))}
        {users.length === 0 && <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhum atendente ainda.</div>}
      </div>
    </main>
  )
}
