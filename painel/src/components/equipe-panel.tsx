'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_MEMBER, PERM_LIST, normalizePerms, type PermKey, type Perms } from '@/lib/perms'

type Member = { id: string; email: string; name: string | null; role: string; perms: Perms | null }
type Invite = { id: string; email: string; role: string; created_at: string }

// Painel de Equipe (convites + membros + permissões). Reusável: aparece na
// aba Configurações › Equipe e na página /equipe.
export default function EquipePanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [meId, setMeId] = useState('')
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [fullAccess, setFullAccess] = useState(false)
  const [newPerms, setNewPerms] = useState<Perms>({ ...DEFAULT_MEMBER })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const d = await (await fetch('/api/team')).json()
    setMembers(d.members || [])
    setInvites(d.invites || [])
    setMeId(d.meId || '')
  }
  useEffect(() => { load() }, [])

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setBusy(true)
    try {
      const r = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: fullAccess ? 'admin' : 'member', perms: fullAccess ? null : newPerms }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg('❌ ' + (d.error || 'erro')); return }
      setEmail(''); setFullAccess(false); setNewPerms({ ...DEFAULT_MEMBER }); setAdding(false)
      setMsg(d.linkedNow ? '✅ adicionado à equipe (a pessoa já tinha conta)' : '✅ convite enviado — a pessoa entra assim que se cadastrar com esse e-mail')
      load()
    } finally { setBusy(false) }
  }

  async function togglePerm(u: Member, key: PermKey) {
    if (u.perms === null) return
    const perms = normalizePerms({ ...u.perms, [key]: !u.perms[key] })
    setMembers((list) => list.map((x) => (x.id === u.id ? { ...x, perms } : x)))
    await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, perms }) }).catch(() => load())
  }

  async function remover(u: Member) {
    if (!confirm(`Remover ${u.name || u.email} da equipe? (a conta continua existindo, só perde acesso a esta empresa)`)) return
    await fetch(`/api/team?id=${u.id}`, { method: 'DELETE' })
    load()
  }

  async function revogar(inv: Invite) {
    if (!confirm(`Cancelar o convite de ${inv.email}?`)) return
    await fetch(`/api/team?invite=${inv.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Convide atendentes por e-mail e defina o que cada um acessa</p>
        <button onClick={() => { setAdding((s) => !s); setMsg('') }} className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
          {adding ? '✕ fechar' : '+ Convidar por e-mail'}
        </button>
      </div>

      {adding && (
        <form onSubmit={convidar} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="font-medium text-gray-800">Convidar atendente</div>
          <p className="mt-1 text-xs text-gray-500">A pessoa cria a conta dela (ou já tem), e você libera o acesso pelo e-mail. Ela nunca vê os dados de outra empresa.</p>
          <div className="mt-3">
            <label className="block">
              <span className="text-xs text-gray-500">E-mail da pessoa</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="pessoa@email.com" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
            </label>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <input type="checkbox" checked={fullAccess} onChange={(e) => setFullAccess(e.target.checked)} className="h-4 w-4 accent-amber-500" />
            <span className="text-amber-800"><b>Acesso total</b> (administrador — pode tudo, inclusive a equipe)</span>
          </label>
          {!fullAccess && (
            <div className="mt-4">
              <span className="text-xs font-medium text-gray-500">Acesso a</span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PERM_LIST.map((perm) => (
                  <label key={perm.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={newPerms[perm.key]} onChange={(e) => setNewPerms((p) => ({ ...p, [perm.key]: e.target.checked }))} className="h-4 w-4 accent-emerald-500" />
                    <span className="text-gray-700">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {busy ? 'enviando…' : 'Enviar convite'}
            </button>
            {msg && <span className="text-sm text-gray-600">{msg}</span>}
          </div>
        </form>
      )}
      {!adding && msg && <div className="mb-4 text-sm text-gray-600">{msg}</div>}

      {invites.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-2 text-sm font-semibold text-amber-800">⏳ Convites aguardando cadastro</div>
          <div className="flex flex-wrap gap-2">
            {invites.map((inv) => (
              <span key={inv.id} className="flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800">
                {inv.email}
                <button onClick={() => revogar(inv)} className="text-amber-500 hover:text-red-500" title="Cancelar convite">✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

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
            {members.map((u) => {
              const admin = u.perms === null
              return (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[11px] font-semibold text-white">
                        {(u.name || u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="truncate font-medium text-gray-800">{u.name || <span className="text-gray-400">sem nome</span>}</span>
                        <div className="truncate text-xs text-gray-400">{u.email}</div>
                        {admin && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">{u.role === 'owner' ? 'dono' : 'admin'} · acesso total</span>}
                        {u.id === meId && <span className="ml-1 text-[10px] font-semibold text-gray-400">(você)</span>}
                      </div>
                    </div>
                  </td>
                  {PERM_LIST.map((perm) => (
                    <td key={perm.key} className="px-2 py-3 text-center">
                      <input type="checkbox" checked={admin ? true : u.perms![perm.key]} disabled={admin} onChange={() => togglePerm(u, perm.key)} className="h-4 w-4 accent-emerald-500 disabled:opacity-40" title={admin ? 'Acesso total' : perm.label} />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'owner' && u.id !== meId && <button onClick={() => remover(u)} className="text-xs text-red-500 hover:underline">remover</button>}
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr><td colSpan={PERM_LIST.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">Nenhum atendente ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        As mudanças de permissão valem no próximo login do atendente. O <b>dono</b> tem acesso total e não pode ser editado aqui.
      </p>
    </div>
  )
}
