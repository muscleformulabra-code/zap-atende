'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Avatar from '@/components/avatar'

type Contact = { id: string; name: string | null; phone: string | null; jid: string; created_at: string; tags: string[]; avatar_url: string | null }
type TagCount = { tag: string; count: number }
type ParsedRow = { name?: string; phone: string; tags?: string[] }

function data(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Lê uma planilha (.xlsx ou .csv) no padrão BotConversa:
// colunas "Primeiro nome | Sobrenome | Telefone | Etiquetas". Também aceita
// planilhas simples (nome, telefone) e arquivos sem cabeçalho.
async function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false })
  if (grid.length === 0) return []

  const header = grid[0].map((c) => norm(String(c ?? '')))
  const hasHeader = header.some((h) => /(nome|telefone|phone|whatsapp|celular|etiqueta|sobrenome)/.test(h))
  const findCol = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)))
  const iFirst = findCol('primeiro nome', 'nome', 'first')
  const iLast = findCol('sobrenome', 'last')
  const iPhone = findCol('telefone', 'whatsapp', 'phone', 'celular')
  const iTags = findCol('etiqueta', 'tag')

  const body = hasHeader ? grid.slice(1) : grid
  const out: ParsedRow[] = []
  for (const row of body) {
    const cell = (i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '')
    let phone = ''
    let name = ''
    let tags: string[] = []
    if (hasHeader && iPhone >= 0) {
      phone = cell(iPhone)
      name = [cell(iFirst), cell(iLast)].filter(Boolean).join(' ').trim()
      tags = cell(iTags).split(/[,;]/).map((t) => t.trim()).filter(Boolean)
    } else {
      // sem cabeçalho: acha a coluna que parece telefone; o resto vira nome.
      const cols = row.map((c) => String(c ?? '').trim())
      const phoneCol = cols.find((c) => c.replace(/\D/g, '').length >= 8)
      if (!phoneCol) continue
      phone = phoneCol
      name = cols.filter((c) => c !== phoneCol).join(' ').trim()
    }
    if (phone.replace(/\D/g, '').length >= 8) out.push({ name: name || undefined, phone, tags: tags.length ? tags : undefined })
  }
  return out
}

export default function Contatos() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tags, setTags] = useState<TagCount[]>([])
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [msgFor, setMsgFor] = useState<Contact | null>(null)

  const load = useCallback(async (q: string, tag: string | null) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    if (tag) params.set('tag', tag)
    const r = await fetch(`/api/contacts${params.toString() ? `?${params}` : ''}`)
    setContacts(await r.json())
    setLoading(false)
  }, [])

  const loadTags = useCallback(async () => {
    const r = await fetch('/api/tags')
    setTags(r.ok ? await r.json() : [])
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { load(search, activeTag); loadTags() }, 300)
    return () => clearTimeout(t)
  }, [search, activeTag, load, loadTags])

  function conversar(c: Contact) {
    setMenuFor(null)
    setMsgFor(c)
  }

  async function excluir(c: Contact) {
    setMenuFor(null)
    if (!confirm(`Excluir ${c.name || c.phone}? Isso apaga o contato e o histórico dele.`)) return
    await fetch(`/api/contacts?id=${c.id}`, { method: 'DELETE' })
    load(search, activeTag); loadTags()
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8" onClick={() => setMenuFor(null)}>
      {/* HEADER */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-sm text-gray-500">{contacts.length} contatos{(search || activeTag) && ' (filtrados)'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 rounded-xl border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50">
            Importar Contatos
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 3v12M7 8l5-5 5 5M5 21h14" /></svg>
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600">
            Criar Contato
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg>
          </button>
        </div>
      </header>

      <div className="flex gap-6">
        {/* PAINEL DE ETIQUETAS */}
        <aside className="w-56 shrink-0">
          <h2 className="text-sm font-bold text-gray-800">Mais popular</h2>
          <p className="mb-3 text-xs text-gray-400">Clique numa etiqueta para filtrar os contatos.</p>
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">Etiquetas</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeTag && (
              <button onClick={() => setActiveTag(null)} className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-white">✕ {activeTag}</button>
            )}
            {tags.filter((t) => t.tag !== activeTag).map((t) => (
              <button key={t.tag} onClick={() => setActiveTag(t.tag)} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-600">
                {t.tag} <span className="text-gray-400">{t.count}</span>
              </button>
            ))}
            {tags.length === 0 && <span className="text-xs text-gray-400">Nenhuma etiqueta ainda. Elas vêm da importação (coluna Etiquetas).</span>}
          </div>
        </aside>

        {/* TABELA */}
        <section className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busca por nome ou telefone…" className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white" />
            </div>
            {loading && <span className="text-xs text-gray-400">carregando…</span>}
          </div>

          <div className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3">Usuários</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Data de inscrição</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-emerald-500" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} phone={c.phone} src={c.avatar_url} className="h-9 w-9 text-[11px]" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-800">{c.name?.trim() || <span className="text-gray-400">Sem nome</span>}</div>
                          {c.tags.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {c.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">{t}</span>)}
                              {c.tags.length > 3 && <span className="text-[10px] text-gray-400">+{c.tags.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">+{c.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{data(c.created_at)}</td>
                    <td className="relative px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); conversar(c) }} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                          Mensagem
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id) }} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">⋮</button>
                      </div>
                      {menuFor === c.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-4 top-12 z-20 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                          <button onClick={() => conversar(c)} className="flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-emerald-50">💬 Enviar mensagem</button>
                          <button onClick={() => excluir(c)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-50">🗑 Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">{search || activeTag ? 'Nenhum contato encontrado.' : 'Nenhum contato ainda. Eles aparecem sozinhos quando um paciente escreve — ou importe sua planilha.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => { load(search, activeTag); loadTags() }} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={() => { load(search, activeTag); loadTags() }} />}
      {msgFor && <MessageModal contact={msgFor} onClose={() => setMsgFor(null)} />}
    </main>
  )
}

// ── MODAL: Importar Contatos (padrão BotConversa) ──
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [drag, setDrag] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file?: File) {
    if (!file) return
    setErr('')
    try {
      const parsed = await parseSpreadsheet(file)
      if (parsed.length === 0) { setErr('Não achei telefones válidos na planilha. Confira o modelo.'); setRows(null); return }
      setRows(parsed); setFileName(file.name)
    } catch {
      setErr('Não consegui ler o arquivo. Use .xlsx ou .csv.')
    }
  }

  async function importar() {
    if (!rows) return
    setBusy(true)
    const r = await fetch('/api/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { setErr(d.error || 'Falha ao importar'); return }
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <button onClick={onClose} className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-white shadow-lg hover:bg-gray-900">✕</button>

        {showRules ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <button onClick={() => setShowRules(false)} className="text-gray-400 hover:text-gray-700">←</button>
              <h2 className="text-xl font-bold text-gray-900">Como preencher a planilha</h2>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2 text-sm text-gray-600">
              <div>
                <p className="font-semibold text-gray-800">1. Colunas (nesta ordem):</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li><b>Primeiro nome</b> (A1), <b>Sobrenome</b> (B1), <b>Telefone</b> (C1), <b>Etiquetas</b> (D1)</li>
                  <li>Uma única aba/planilha.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800">2. Telefone:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Sempre com DDI + DDD. Brasil = 55. Ex: <code className="rounded bg-gray-100 px-1">5561999998888</code></li>
                  <li>Pode ter pontos, espaços ou traços — a gente limpa sozinho.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800">3. Etiquetas (opcional):</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Separe várias por vírgula. Ex: <code className="rounded bg-gray-100 px-1">psiquiatria, lead-frio</code></li>
                  <li>Até 40 caracteres cada.</li>
                </ul>
              </div>
              <p className="text-xs text-gray-400">Também aceitamos .csv simples com <code>nome,telefone</code>.</p>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-center text-2xl font-bold text-gray-900">Importar Contatos</h2>
            <p className="mb-6 text-center text-sm text-gray-500">
              Faça o upload de um arquivo <b>.xlsx</b> ou <b>.csv</b>. Veja as regras de preenchimento{' '}
              <button onClick={() => setShowRules(true)} className="font-medium text-emerald-600 hover:underline">aqui</button>.
            </p>

            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'}`}
            >
              {rows ? (
                <>
                  <span className="text-3xl">✅</span>
                  <p className="mt-2 font-semibold text-emerald-700">{rows.length} contatos prontos</p>
                  <p className="text-xs text-gray-500">{fileName} — clique para trocar</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 font-semibold text-emerald-600">
                    Importar arquivo
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 3v12M7 8l5-5 5 5M5 21h14" /></svg>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Clique para selecionar ou arraste e solte o arquivo.</p>
                </>
              )}
            </div>

            {err && <p className="mt-3 text-center text-sm text-red-500">{err}</p>}

            <button onClick={importar} disabled={!rows || busy} className="mt-6 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-200">
              {busy ? 'Importando…' : rows ? `Importar ${rows.length} contatos` : 'Importar contatos'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── MODAL: Criar Contato ──
function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    const tagArr = tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
    const r = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, tags: tagArr }) })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { setErr(d.error || 'erro'); return }
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-white shadow-lg hover:bg-gray-900">✕</button>
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">Criar Contato</h2>
        <label className="mb-3 block">
          <span className="text-xs font-medium text-gray-500">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
        </label>
        <label className="mb-3 block">
          <span className="text-xs font-medium text-gray-500">WhatsApp (com DDI + DDD)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5561999998888" required className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
        </label>
        <label className="mb-5 block">
          <span className="text-xs font-medium text-gray-500">Etiquetas (separadas por vírgula)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="psiquiatria, lead-frio" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500" />
        </label>
        {err && <p className="mb-3 text-center text-sm text-red-500">❌ {err}</p>}
        <button disabled={busy} className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-emerald-200">{busy ? 'Salvando…' : 'Salvar contato'}</button>
      </form>
    </div>
  )
}

// ── MODAL: Enviar mensagem para um contato ──
function MessageModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((d) => setOnline(!!d.whatsapp)).catch(() => setOnline(false))
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true); setResult(null)
    const r = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: contact.id, text: t }) })
    const d = await r.json()
    setBusy(false)
    if (d.warn) setResult({ ok: false, msg: d.warn })
    else { setResult({ ok: true, msg: 'Mensagem enviada! Veja a conversa no Inbox.' }); setText('') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-white shadow-lg hover:bg-gray-900">✕</button>

        <div className="mb-4 flex items-center gap-3">
          <Avatar name={contact.name} phone={contact.phone} src={contact.avatar_url} className="h-11 w-11 text-sm" />
          <div>
            <div className="font-semibold text-gray-800">{contact.name?.trim() || 'Sem nome'}</div>
            <div className="text-xs text-gray-400">+{contact.phone}</div>
          </div>
        </div>

        {online === false && (
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠️ WhatsApp desconectado no momento. Reconecte escaneando o QR para a mensagem chegar.
          </div>
        )}

        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus placeholder="Escreva sua mensagem…" className="w-full resize-none rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-emerald-500" />

        {result && (
          <p className={`mt-2 text-sm ${result.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {result.ok ? '✅ ' : '⚠️ '}{result.msg}
          </p>
        )}

        <button disabled={busy || !text.trim()} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50">
          {busy ? 'Enviando…' : 'Enviar mensagem'}
        </button>
      </form>
    </div>
  )
}
