'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_MEMBER, PERM_LIST, normalizePerms, type PermKey, type Perms } from '@/lib/perms'

type User = { id: string; email: string; name: string | null; created_at: string; perms: Perms | null }

export default function Equipe() {
  const [users, setUsers] = useState<User[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPerms, setNewPerms] = useState<Perms>({ ...DEFAULT_MEMBER })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setUsers(await (await fetch('/api/team')).json())
  }
  useEffect(() => { load() }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setBusy(true)
    try {
      const r = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, perms: newPerms }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg('❌ ' + (d.error || 'erro')); return }
      setName(''); setEmail(''); setPassword(''); setNewPerms({ ...DEFAULT_MEMBER }); setAdding(false); setMsg('✅ atendente criado')
      load()
    } finally { setBusy(false) }
  }

  async function renomear(u: User) {
    const novo = prompt(`Nome do atendente (aparece nas mensagens):`, u.name || '')
    if (novo === null) return
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, name: novo.trim() || null } : x)))
    await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, name: novo }) }).catch(() => load())
  }

  async function togglePerm(u: User, key: PermKey) {
    if (u.perms === null) return // dono/admin não edita
    const perms = normalizePerms({ ...u.perms, [key]: !u.perms[key] })
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, perms } : x))) // otimista
    await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, perms }),
    }).catch(() => load())
  }

  async function remover(id: string, email: string) {
    if (!confirm(`Remover o acesso de ${email}?`)) return
    await fetch(`/api/team?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500">Atendentes e o que cada um pode acessar</p>
        </div>
        <button onClick={() => { setAdding((s) => !s); setMsg('') }} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
          {adding ? '✕ fechar' : '+ Adicionar membro'}
        </button>
      </header>

      {adding && (
        <form onSubmit={criar} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="font-medium text-gray-800">Novo atendente</div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="text-xs text-gray-500">Nome (aparece nas mensagens)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Isabella Martins" required className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
            </label>
            <label className="flex-1">
              <span className="text-xs text-gray-500">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
            </label>
            <label className="flex-1">
              <span className="text-xs text-gray-500">Senha (mín. 6)</span>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
            </label>
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-gray-500">Acesso a</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PERM_LIST.map((perm) => (
                <label key={perm.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={newPerms[perm.key]}
                    onChange={(e) => setNewPerms((p) => ({ ...p, [perm.key]: e.target.checked }))}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className="text-gray-700">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {busy ? 'criando…' : 'Criar atendente'}
            </button>
            {msg && <span className="text-sm text-gray-600">{msg}</span>}
          </div>
        </form>
      )}
      {!adding && msg && <div className="mb-4 text-sm text-gray-600">{msg}</div>}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">Atendente</th>
              {PERM_LIST.map((perm) => (
                <th key={perm.key} className="px-2 py-3 text-center font-medium">{perm.label}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const admin = u.perms === null
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[11px] font-semibold text-white">
                        {(u.name || u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-gray-800">{u.name || <span className="text-gray-400">sem nome</span>}</span>
                          <button onClick={() => renomear(u)} className="text-[11px] text-emerald-600 hover:underline">editar</button>
                        </div>
                        <div className="truncate text-xs text-gray-400">{u.email}</div>
                        {admin && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">dono / admin</span>}
                      </div>
                    </div>
                  </td>
                  {PERM_LIST.map((perm) => (
                    <td key={perm.key} className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={admin ? true : u.perms![perm.key]}
                        disabled={admin}
                        onChange={() => togglePerm(u, perm.key)}
                        className="h-4 w-4 accent-emerald-500 disabled:opacity-40"
                        title={admin ? 'O dono tem acesso total' : perm.label}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    {!admin && <button onClick={() => remover(u.id, u.email)} className="text-xs text-red-500 hover:underline">remover</button>}
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr><td colSpan={PERM_LIST.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">Nenhum atendente ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        As mudanças de permissão valem no próximo login do atendente (o acesso é lido do login). O <b>dono</b> tem acesso total e não pode ser editado aqui.
      </p>
    </main>
  )
}
