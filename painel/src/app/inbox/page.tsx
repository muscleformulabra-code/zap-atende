'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from '@/components/avatar'

type Conversa = {
  contact_id: string
  name: string | null
  phone: string | null
  avatar_url: string | null
  last_text: string | null
  last_from_me: boolean | null
  last_sent_at: string | null
  status: string
}
type Msg = { id: string; from_me: boolean; text: string | null; sent_at: string | null }
type Card = { id: string; name: string | null; phone: string | null; jid: string; avatar_url: string | null; created_at: string; status: string }
type FlowItem = { id: string; name: string; is_active?: boolean }

function hora(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function dataHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  active: { label: '🤖 Automação ativa', badge: 'bg-sky-50 text-sky-700', dot: 'bg-sky-400' },
  handoff: { label: '🙋 Em atendimento', badge: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-400' },
  done: { label: '✅ Concluído', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
}

const EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😉', '😎', '🤗', '🤔', '😅', '🙏', '👍', '👎', '👏', '🙌', '💪', '👌', '🤝', '❤️', '🔥', '✨', '🎉', '✅', '❌', '⚠️', '💰', '💳', '📅', '🕐', '📍', '📱', '💬', '😢', '😭', '😡', '🥰', '😴', '🤒']

type Tab = 'abertas' | 'concluidas' | 'todas'

export default function Inbox() {
  const [convs, setConvs] = useState<Conversa[]>([])
  const [tab, setTab] = useState<Tab>('abertas')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<Conversa | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [card, setCard] = useState<Card | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [quickReplies, setQuickReplies] = useState<{ id: string; shortcut: string; text: string }[]>([])
  const [flows, setFlows] = useState<FlowItem[]>([])
  const [plusOpen, setPlusOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/quick-replies').then((r) => r.json()).then(setQuickReplies).catch(() => {})
    fetch('/api/flows').then((r) => r.json()).then(setFlows).catch(() => {})
  }, [])

  const showQR = text.startsWith('/')
  const qrMatches = showQR
    ? quickReplies.filter((q) => ('/' + q.shortcut).toLowerCase().startsWith(text.toLowerCase())).slice(0, 6)
    : []

  const loadConvs = useCallback(async () => {
    const r = await fetch('/api/conversations')
    setConvs(await r.json())
  }, [])
  const loadMsgs = useCallback(async (id: string) => {
    const r = await fetch(`/api/messages?contactId=${id}`)
    setMsgs(await r.json())
  }, [])
  const loadCard = useCallback(async (id: string) => {
    const r = await fetch(`/api/contact?contactId=${id}`)
    setCard(r.ok ? await r.json() : null)
  }, [])

  useEffect(() => {
    loadConvs()
    const t = setInterval(loadConvs, 2500)
    return () => clearInterval(t)
  }, [loadConvs])

  useEffect(() => {
    if (!sel) return
    loadMsgs(sel.contact_id)
    loadCard(sel.contact_id)
    const t = setInterval(() => loadMsgs(sel.contact_id), 1500)
    return () => clearInterval(t)
  }, [sel, loadMsgs, loadCard])

  function selecionar(c: Conversa) {
    setSel(c)
    setPlusOpen(false); setEmojiOpen(false); setFlowOpen(false); setAutoOpen(false)
  }

  useEffect(() => { endRef.current?.scrollIntoView() }, [msgs])

  async function send() {
    const t = text.trim()
    if (!t || !sel || sending) return
    setText('')
    setMsgs((m) => [...m, { id: 'tmp' + Date.now(), from_me: true, text: t, sent_at: new Date().toISOString() }])
    setSending(true)
    try {
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: sel.contact_id, text: t }),
      })
      const d = await r.json()
      if (d.warn) alert('⚠️ ' + d.warn)
    } finally { setSending(false) }
  }

  async function mudarStatus(status: 'done' | 'handoff' | 'active' | 'restart') {
    if (!sel) return
    await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: sel.contact_id, status }) })
    const novo = status === 'restart' ? 'active' : status
    setCard((c) => (c ? { ...c, status: novo } : c))
    setSel((s) => (s ? { ...s, status: novo } : s))
    setAutoOpen(false)
    loadConvs()
  }

  async function enviarFluxo(f: FlowItem) {
    if (!sel) return
    setFlowOpen(false); setPlusOpen(false)
    setMsgs((m) => [...m, { id: 'tmp' + Date.now(), from_me: true, text: `▶️ Fluxo enviado: ${f.name}`, sent_at: new Date().toISOString() }])
    const r = await fetch('/api/send-flow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: sel.contact_id, flowId: f.id }) })
    const d = await r.json()
    if (d.warn) alert('⚠️ ' + d.warn)
    loadMsgs(sel.contact_id)
  }

  async function anexar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPlusOpen(false)
    if (!file || !sel) return
    if (file.size > 15 * 1024 * 1024) { alert('Arquivo muito grande (máx. 15 MB).'); return }
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document'
    const dataUrl: string = await new Promise((res, rej) => {
      const rd = new FileReader()
      rd.onload = () => res(rd.result as string)
      rd.onerror = rej
      rd.readAsDataURL(file)
    })
    setMsgs((m) => [...m, { id: 'tmp' + Date.now(), from_me: true, text: `📎 ${file.name}`, sent_at: new Date().toISOString() }])
    const r = await fetch('/api/send-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: sel.contact_id, kind, dataUrl, fileName: file.name }),
    })
    const d = await r.json()
    if (d.warn) alert('⚠️ ' + d.warn)
    if (fileRef.current) fileRef.current.value = ''
    loadMsgs(sel.contact_id)
  }

  function inserirEmoji(e: string) {
    setText((t) => t + e)
    setEmojiOpen(false)
    inputRef.current?.focus()
  }

  const filtered = convs
    .filter((c) => (tab === 'todas' ? true : tab === 'concluidas' ? c.status === 'done' : c.status !== 'done'))
    .filter((c) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    })
  const abertasCount = convs.filter((c) => c.status !== 'done').length
  const curStatus = card?.status ?? sel?.status ?? 'active'

  return (
    <div className="flex h-full">
      {/* LISTA DE CONVERSAS */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 pb-3 pt-3">
          <h1 className="font-bold text-gray-900">Inbox</h1>
          <div className="mt-2 flex gap-1 text-xs">
            {([['abertas', `Abertas (${abertasCount})`], ['concluidas', 'Concluídas'], ['todas', 'Todas']] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-2.5 py-1 font-medium ${tab === k ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
            ))}
          </div>
          {/* busca */}
          <div className="relative mt-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contato…" className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-sm outline-none focus:border-emerald-400 focus:bg-white" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-gray-400 hover:text-gray-600">✕</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const waiting = c.last_from_me === false && c.status !== 'done'
            const active = sel?.contact_id === c.contact_id
            return (
              <button key={c.contact_id} onClick={() => selecionar(c)} className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-3 text-left hover:bg-gray-50 ${active ? 'bg-emerald-50' : ''}`}>
                <div className="relative shrink-0">
                  <Avatar name={c.name} phone={c.phone} src={c.avatar_url} className="h-10 w-10 text-sm" />
                  {c.status === 'done' && <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] shadow">✅</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium text-gray-800">{c.name?.trim() || c.phone || 'Sem nome'}</span>
                    {waiting && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-400" title="aguardando resposta" />}
                  </div>
                  <div className="truncate text-xs text-gray-500">{c.last_from_me ? 'você: ' : ''}{c.last_text || '—'}</div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && <div className="px-4 py-12 text-center text-sm text-gray-400">{search ? 'Nenhum contato encontrado.' : `Nenhuma conversa ${tab === 'concluidas' ? 'concluída' : tab === 'abertas' ? 'aberta' : ''}.`}</div>}
        </div>
      </aside>

      {/* CONVERSA */}
      <main className="flex min-w-0 flex-1 flex-col bg-[#e5ddd5]">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Selecione uma conversa à esquerda.</div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
              <Avatar name={sel.name} phone={sel.phone} src={card?.avatar_url} className="h-9 w-9 text-xs" />
              <div>
                <div className="text-sm font-medium text-gray-800">{sel.name?.trim() || sel.phone}</div>
                <div className="text-xs text-gray-400">{sel.phone}</div>
              </div>
              <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[sel.status]?.badge ?? STATUS.active.badge}`}>{STATUS[sel.status]?.label ?? STATUS.active.label}</span>
            </header>

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {msgs.map((m) => (
                <div key={m.id} className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${m.from_me ? 'self-end rounded-tr-sm bg-[#dcf8c6] text-gray-800' : 'self-start rounded-tl-sm bg-white text-gray-800'}`}>
                  {m.text || <span className="italic text-gray-400">[mídia]</span>}
                  <div className="mt-0.5 text-right text-[10px] text-gray-400">{hora(m.sent_at)}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* BARRA DE ENVIO */}
            <div className="relative border-t border-gray-200 bg-white p-3">
              <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" onChange={anexar} className="hidden" />

              {/* respostas rápidas (/atalho) */}
              {qrMatches.length > 0 && (
                <div className="absolute bottom-16 left-3 z-20 w-96 max-w-[80%] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="border-b border-gray-100 px-3 py-1.5 text-[11px] font-medium text-gray-400">Respostas rápidas</div>
                  {qrMatches.map((q) => (
                    <button key={q.id} onClick={() => setText(q.text)} className="flex w-full flex-col items-start border-b border-gray-50 px-3 py-2 text-left last:border-0 hover:bg-emerald-50">
                      <span className="font-mono text-xs text-emerald-700">/{q.shortcut}</span>
                      <span className="truncate text-xs text-gray-600">{q.text}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* menu do "+" (4 opções) */}
              {plusOpen && (
                <div className="absolute bottom-16 left-3 z-20 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"><span className="text-lg">📎</span> Foto, vídeo ou PDF</button>
                  <button onClick={() => { setEmojiOpen((v) => !v); setFlowOpen(false) }} className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"><span className="text-lg">😀</span> Emoji</button>
                  <button onClick={() => { setFlowOpen((v) => !v); setEmojiOpen(false) }} className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"><span className="text-lg">🔀</span> Enviar fluxo</button>
                  <button onClick={() => { setText('/'); setPlusOpen(false); inputRef.current?.focus() }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"><span className="text-lg">⚡</span> Mensagem automática (/)</button>
                </div>
              )}

              {/* seletor de emoji */}
              {emojiOpen && (
                <div className="absolute bottom-16 left-16 z-30 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => inserirEmoji(e)} className="rounded-lg p-1.5 text-xl hover:bg-gray-100">{e}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* seletor de fluxo */}
              {flowOpen && (
                <div className="absolute bottom-16 left-16 z-30 max-h-80 w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="sticky top-0 border-b border-gray-100 bg-white px-3 py-2 text-[11px] font-medium text-gray-400">Escolha um fluxo para enviar</div>
                  {flows.map((f) => (
                    <button key={f.id} onClick={() => enviarFluxo(f)} className="flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2.5 text-left text-sm text-gray-700 last:border-0 hover:bg-emerald-50">
                      <span className="text-emerald-500">🔀</span> <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  {flows.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-400">Nenhum fluxo cadastrado.</div>}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button onClick={() => { setPlusOpen((v) => !v); setEmojiOpen(false); setFlowOpen(false) }} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xl transition ${plusOpen ? 'rotate-45 border-emerald-500 text-emerald-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`} title="Anexar / emoji / fluxo">+</button>
                <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escreva uma mensagem… (ou /atalho)" className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-emerald-500" />
                <button onClick={send} disabled={sending} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">enviar</button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* FICHA DO LEAD */}
      {sel && (
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
          <div className="flex flex-col items-center border-b border-gray-100 px-4 py-5">
            <Avatar name={sel.name} phone={sel.phone} src={card?.avatar_url} className="h-16 w-16 text-xl" />
            <div className="mt-2 text-center text-base font-semibold text-gray-800">{sel.name?.trim() || sel.phone || 'Sem nome'}</div>
            <span className={`mt-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS[curStatus]?.badge ?? STATUS.active.badge}`}>{STATUS[curStatus]?.label ?? STATUS.active.label}</span>
          </div>

          <div className="space-y-3 border-b border-gray-100 px-4 py-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600"><span>📱</span><span>{card?.phone ?? sel.phone ?? '—'}</span></div>
            <div className="flex items-center gap-2 text-gray-600"><span>✉️</span><span className="text-gray-400">—</span></div>
            <div className="flex items-center gap-2 text-gray-600"><span>🗓️</span><span>Inscrição: {dataHora(card?.created_at ?? null)}</span></div>
          </div>

          {/* CONTROLE DE AUTOMAÇÃO */}
          <div className="border-b border-gray-100 px-4 py-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <button onClick={() => setAutoOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
                <span className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{curStatus === 'handoff' ? '⏸️' : curStatus === 'done' ? '✅' : '▶️'}</span>
                  Automação {curStatus === 'active' ? 'ativa' : curStatus === 'handoff' ? 'pausada' : 'concluída'}
                </span>
                <span className={`text-gray-400 transition-transform ${autoOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {autoOpen && (
                <div className="mt-3 space-y-2">
                  <button onClick={() => mudarStatus('active')} className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-600">▶️ Iniciar automação</button>
                  <button onClick={() => mudarStatus('restart')} className="w-full rounded-lg border border-emerald-400 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50">🔄 Reiniciar do começo</button>
                  <button onClick={() => mudarStatus('handoff')} className="w-full rounded-lg bg-red-50 py-2 text-sm font-medium text-red-500 hover:bg-red-100">⏸️ Pausar automação</button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 px-4 py-4">
            {curStatus !== 'done' ? (
              <button onClick={() => mudarStatus('done')} className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">✓ Marcar como Concluído</button>
            ) : (
              <button onClick={() => mudarStatus('handoff')} className="w-full rounded-xl border border-emerald-500 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50">↩ Reabrir atendimento</button>
            )}
            {curStatus === 'active' && (
              <button onClick={() => mudarStatus('handoff')} className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">🙋 Assumir (pausar automação)</button>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
