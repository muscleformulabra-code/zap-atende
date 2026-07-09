'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Contact = { id: string; name: string | null; phone: string | null; jid: string; created_at: string }

function initials(name: string | null, phone: string | null) {
  if (name?.trim()) return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return (phone ?? '?').slice(-2)
}
function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Lê um CSV simples: cada linha "nome,telefone" (ou só telefone). Pula cabeçalho.
function parseCSV(text: string): { name?: string; phone: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: { name?: string; phone: string }[] = []
  for (const line of lines) {
    const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    const joined = cols.join(' ').toLowerCase()
    if (/(telefone|phone|whatsapp|celular)/.test(joined) && !/\d{6,}/.test(line)) continue // cabeçalho
    // Acha a coluna que parece telefone (tem muitos dígitos); o resto vira nome.
    const phoneCol = cols.find((c) => c.replace(/\D/g, '').length >= 8)
    if (!phoneCol) continue
    const name = cols.filter((c) => c !== phoneCol).join(' ').trim()
    out.push({ name: name || undefined, phone: phoneCol })
  }
  return out
}

export default function Contatos() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    const r = await fetch(`/api/contacts${q ? `?search=${encodeURIComponent(q)}` : ''}`)
    setContacts(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, load])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    const r = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone }) })
    const d = await r.json()
    if (!r.ok) return setMsg('❌ ' + (d.error || 'erro'))
    setName(''); setPhone(''); setAdding(false); setMsg('✅ contato salvo')
    load(search)
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg('⏳ importando…')
    const rows = parseCSV(await file.text())
    if (rows.length === 0) { setMsg('❌ nenhum telefone encontrado no arquivo'); return }
    const r = await fetch('/api/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
    const d = await r.json()
    setMsg(r.ok ? `✅ ${d.imported} contatos importados` : '❌ ' + (d.error || 'erro'))
    if (fileRef.current) fileRef.current.value = ''
    load(search)
  }

  async function conversar(c: Contact) {
    const t = prompt(`Mensagem para ${c.name || c.phone}:`)
    if (!t?.trim()) return
    const r = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: c.id, text: t }) })
    const d = await r.json()
    alert(d.warn ? '⚠️ ' + d.warn : '✅ Mensagem enviada! Veja a conversa no Inbox.')
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-sm text-gray-500">{contacts.length} contatos {search && '(filtrados)'}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={importar} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">⬆ Importar CSV</button>
          <button onClick={() => { setAdding((s) => !s); setMsg('') }} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">{adding ? '✕ fechar' : '+ Criar contato'}</button>
        </div>
      </header>

      {adding && (
        <form onSubmit={criar} className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="flex-1">
            <span className="text-xs text-gray-500">Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-500">WhatsApp (com DDD)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="ex: 5561999998888" required className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Salvar</button>
        </form>
      )}

      <div className="mb-3 flex items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Buscar por nome ou telefone…" className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-emerald-500" />
        {loading && <span className="text-xs text-gray-400">carregando…</span>}
      </div>
      {msg && <div className="mb-3 text-sm text-gray-600">{msg}</div>}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Cadastrado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[11px] font-semibold text-white">{initials(c.name, c.phone)}</div>
                    <span className="text-gray-800">{c.name?.trim() || <span className="text-gray-400">Sem nome</span>}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">+{c.phone}</td>
                <td className="px-4 py-3 text-gray-500">{data(c.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => conversar(c)} className="rounded-lg px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50">💬 Conversar</button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">{search ? 'Nenhum contato encontrado.' : 'Nenhum contato ainda. Eles aparecem sozinhos quando um paciente escreve — ou importe seu CSV.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        💡 <b>Importar CSV:</b> um contato por linha, no formato <code>nome,telefone</code> (o telefone com DDD e país, ex: <code>5561999998888</code>). Contatos repetidos são atualizados, não duplicados.
      </p>
    </main>
  )
}
