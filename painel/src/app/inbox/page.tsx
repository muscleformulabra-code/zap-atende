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
  tags: string[]
  assigned_to: string | null
}
type Msg = { id: string; from_me: boolean; text: string | null; sent_at: string | null; media_url?: string | null; media_type?: string | null; wa_message_id?: string | null }
type Card = { id: string; name: string | null; phone: string | null; jid: string; avatar_url: string | null; created_at: string; status: string; assigned_to: string | null; note: string | null }
type Attendant = { id: string; email: string; name: string | null }
type FlowItem = { id: string; name: string; is_active?: boolean }

// Beep de notificação (Web Audio) — usado quando chega mensagem nova do
// paciente e o som está ligado (toggle na faixa superior).
function beepNotify() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.start(); o.stop(ctx.currentTime + 0.26)
    o.onended = () => ctx.close()
  } catch {}
}

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
  const [team, setTeam] = useState<Attendant[]>([])
  const [myEmail, setMyEmail] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const [editMsgId, setEditMsgId] = useState<string | null>(null)
  const [editMsgVal, setEditMsgVal] = useState('')
  const [fwdMsg, setFwdMsg] = useState<Msg | null>(null)
  const [fwdSearch, setFwdSearch] = useState('')
  const [filtAssign, setFiltAssign] = useState<'todos' | 'meus' | 'nao'>('todos')
  const [filtTag, setFiltTag] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [fichaFlow, setFichaFlow] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null) // container das mensagens (pra saber se está no fim)
  const justSelected = useRef(true) // ao abrir/trocar conversa, desce pro fim 1x
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastInboundAt = useRef<number | null>(null) // pra tocar o som só em msg nova do paciente

  useEffect(() => {
    fetch('/api/quick-replies').then((r) => r.json()).then(setQuickReplies).catch(() => {})
    fetch('/api/flows').then((r) => r.json()).then(setFlows).catch(() => {})
    fetch('/api/attendants').then((r) => r.json()).then((d) => setTeam(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/me').then((r) => r.json()).then((d) => setMyEmail(d.email ?? null)).catch(() => {})
  }, [])

  const showQR = text.startsWith('/')
  const qrMatches = showQR
    ? quickReplies.filter((q) => ('/' + q.shortcut).toLowerCase().startsWith(text.toLowerCase())).slice(0, 6)
    : []

  const loadConvs = useCallback(async () => {
    const r = await fetch('/api/conversations')
    const data: Conversa[] = await r.json()
    setConvs(data)
    // Som de notificação: toca quando chega mensagem NOVA do paciente (não a nossa)
    // e o som está ligado no toggle da faixa superior. Não toca na 1ª carga.
    try {
      const maxIn = data
        .filter((c) => c.last_from_me === false && c.last_sent_at)
        .reduce((m, c) => Math.max(m, Date.parse(c.last_sent_at as string)), 0)
      if (lastInboundAt.current !== null && maxIn > lastInboundAt.current && localStorage.getItem('za_sound') === '1') {
        beepNotify()
      }
      lastInboundAt.current = Math.max(lastInboundAt.current ?? 0, maxIn)
    } catch {}
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
    justSelected.current = true // ao abrir a conversa, desce pro fim uma vez
    loadMsgs(sel.contact_id)
    loadCard(sel.contact_id)
    const t = setInterval(() => loadMsgs(sel.contact_id), 1500)
    return () => clearInterval(t)
  }, [sel, loadMsgs, loadCard])

  // Deep-link do painel: /inbox?c=<contact_id> abre a conversa direto.
  const deepLinked = useRef(false)
  useEffect(() => {
    if (deepLinked.current || convs.length === 0) return
    const c = new URLSearchParams(window.location.search).get('c')
    if (!c) { deepLinked.current = true; return }
    const found = convs.find((x) => x.contact_id === c)
    if (found) { setSel(found); deepLinked.current = true }
  }, [convs])

  function selecionar(c: Conversa) {
    setSel(c)
    setPlusOpen(false); setEmojiOpen(false); setFlowOpen(false); setAutoOpen(false); setAssignOpen(false)
  }

  // Rolagem inteligente: só desce pro fim ao ABRIR a conversa, ou quando o
  // atendente já está no fim. Se ele rolou pra cima (lendo/copiando antigas), o
  // poll de 1,5s NÃO arrasta a tela pra baixo.
  useEffect(() => {
    const el = scrollRef.current
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140
    if (justSelected.current) { endRef.current?.scrollIntoView(); justSelected.current = false }
    else if (nearBottom) endRef.current?.scrollIntoView()
  }, [msgs])

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

  async function atribuir(name: string | null) {
    if (!sel) return
    setCard((c) => (c ? { ...c, assigned_to: name } : c))
    setAssignOpen(false)
    await fetch('/api/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: sel.contact_id, assignedTo: name }) })
  }

  // Sincroniza a observação quando troca de contato (ou quando a ficha carrega).
  useEffect(() => { setNote(card?.note ?? ''); setNoteSaved(false); setEditName(false); setFichaFlow(false) }, [sel?.contact_id, card?.note])

  async function salvarNome() {
    const novo = nameVal.trim()
    setEditName(false)
    if (!sel) return
    setCard((c) => (c ? { ...c, name: novo || null } : c))
    setSel((s) => (s ? { ...s, name: novo || null } : s))
    setConvs((list) => list.map((x) => (x.contact_id === sel.contact_id ? { ...x, name: novo || null } : x)))
    await fetch('/api/contact', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: sel.contact_id, name: novo }) }).catch(() => {})
  }

  async function salvarNota() {
    if (!sel) return
    await fetch('/api/contact', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: sel.contact_id, note }) }).catch(() => {})
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 1500)
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
    const files = Array.from(e.target.files || [])
    setPlusOpen(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!files.length || !sel) return
    // Envia VÁRIOS arquivos, um por um (na ordem escolhida).
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { alert(`"${file.name}" é muito grande (máx. 15 MB).`); continue }
      const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document'
      const dataUrl: string = await new Promise((res, rej) => {
        const rd = new FileReader()
        rd.onload = () => res(rd.result as string)
        rd.onerror = rej
        rd.readAsDataURL(file)
      })
      setMsgs((m) => [...m, { id: 'tmp' + Date.now() + file.name, from_me: true, text: `📎 ${file.name}`, sent_at: new Date().toISOString() }])
      const r = await fetch('/api/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: sel.contact_id, kind, dataUrl, fileName: file.name }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.warn) alert('⚠️ ' + d.warn)
    }
    loadMsgs(sel.contact_id)
  }

  async function apagarMsg(m: Msg) {
    if (!m.from_me) return
    if (!confirm('Apagar para todos?\n\nSe a mensagem ainda estiver no prazo do WhatsApp (mensagens recentes), some pra você E pro paciente. Se for antiga, some só do seu inbox.')) return
    setMsgs((list) => list.filter((x) => x.id !== m.id)) // some na hora
    await fetch('/api/delete-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: m.id }) }).catch(() => {})
  }

  function iniciarEdicao(m: Msg) { setEditMsgId(m.id); setEditMsgVal(m.text || '') }
  async function salvarEdicao() {
    const id = editMsgId, novo = editMsgVal.trim()
    setEditMsgId(null)
    if (!id || !novo) return
    setMsgs((list) => list.map((x) => (x.id === id ? { ...x, text: novo } : x)))
    await fetch('/api/edit-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: id, text: novo }) }).catch(() => {})
  }

  async function encaminhar(targetContactId: string) {
    if (!fwdMsg) return
    const m = fwdMsg
    setFwdMsg(null); setFwdSearch('')
    const r = await fetch('/api/forward', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: m.id, targetContactId }) })
    const d = await r.json().catch(() => ({}))
    if (d.warn) alert('⚠️ ' + d.warn)
    else alert('✅ Encaminhado!')
  }

  function inserirEmoji(e: string) {
    setText((t) => t + e)
    setEmojiOpen(false)
    inputRef.current?.focus()
  }

  const myName = team.find((a) => (a.email || '').toLowerCase() === (myEmail || '').toLowerCase())?.name || myEmail?.split('@')[0] || 'Eu'
  const allTags = [...new Set(convs.flatMap((c) => c.tags || []))].sort()
  const filtered = convs
    .filter((c) => (tab === 'todas' ? true : tab === 'concluidas' ? c.status === 'done' : c.status !== 'done'))
    .filter((c) => (filtAssign === 'meus' ? c.assigned_to === myName : filtAssign === 'nao' ? !c.assigned_to : true))
    .filter((c) => (filtTag ? (c.tags || []).includes(filtTag) : true))
    .filter((c) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    })
  const abertasCount = convs.filter((c) => c.status !== 'done').length
  const nFiltros = (filtAssign !== 'todos' ? 1 : 0) + (filtTag ? 1 : 0)
  const curStatus = card?.status ?? sel?.status ?? 'active'
  const assignedTo = card?.assigned_to ?? null

  return (
    <div className="flex h-full">
      {/* LISTA DE CONVERSAS */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 pb-3 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1 text-xs">
              {([['abertas', `Abertas (${abertasCount})`], ['concluidas', 'Concluídas'], ['todas', 'Todas']] as [Tab, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-2.5 py-1 font-medium ${tab === k ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setFilterOpen((v) => !v)} title="Filtros" className={`relative rounded-lg p-1.5 ${nFiltros ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                {nFiltros > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">{nFiltros}</span>}
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Atribuição</div>
                    <div className="mb-3 flex gap-1">
                      {([['todos', 'Todos'], ['meus', 'Meus'], ['nao', 'Sem dono']] as [typeof filtAssign, string][]).map(([k, l]) => (
                        <button key={k} onClick={() => setFiltAssign(k)} className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium ${filtAssign === k ? 'bg-sky-100 text-sky-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{l}</button>
                      ))}
                    </div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Etiqueta</div>
                    <select value={filtTag ?? ''} onChange={(e) => setFiltTag(e.target.value || null)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm outline-none focus:border-emerald-400">
                      <option value="">— todas —</option>
                      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {nFiltros > 0 && <button onClick={() => { setFiltAssign('todos'); setFiltTag(null) }} className="mt-3 w-full text-center text-xs font-medium text-red-500 hover:underline">Limpar filtros</button>}
                  </div>
                </>
              )}
            </div>
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

            <div ref={scrollRef} className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {msgs.map((m) => {
                const hasMedia = !!m.media_url
                const caption = m.text && !/^\[.*\]$/.test(m.text.trim()) ? m.text : null // ignora rótulos "[imagem]"
                return (
                  <div key={m.id} className={`group relative max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${m.from_me ? 'self-end rounded-tr-sm bg-[#dcf8c6] text-gray-800' : 'self-start rounded-tl-sm bg-white text-gray-800'}`}>
                    {/* Ações (aparecem no hover) — fora do balão, do lado */}
                    {!String(m.id).startsWith('tmp') && editMsgId !== m.id && (
                      <div className={`absolute top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition group-hover:opacity-100 ${m.from_me ? '-left-16' : '-right-16'}`}>
                        <button onClick={() => setFwdMsg(m)} title="Encaminhar" className="rounded-full bg-white p-1 text-gray-400 shadow hover:text-sky-500">↪</button>
                        {m.from_me && !m.media_url && m.sent_at && Date.now() - Date.parse(m.sent_at) < 15 * 60 * 1000 && <button onClick={() => iniciarEdicao(m)} title="Editar (só até 15 min)" className="rounded-full bg-white p-1 text-gray-400 shadow hover:text-emerald-600">✏️</button>}
                        {m.from_me && <button onClick={() => apagarMsg(m)} title="Apagar" className="rounded-full bg-white p-1 text-gray-400 shadow hover:text-red-500">🗑</button>}
                      </div>
                    )}
                    {editMsgId === m.id ? (
                      <div>
                        <textarea value={editMsgVal} onChange={(e) => setEditMsgVal(e.target.value)} rows={2} autoFocus className="w-64 max-w-full rounded-lg border border-gray-300 p-1.5 text-sm outline-none focus:border-emerald-500" />
                        <div className="mt-1 flex justify-end gap-2 text-xs">
                          <button onClick={() => setEditMsgId(null)} className="text-gray-400 hover:underline">cancelar</button>
                          <button onClick={salvarEdicao} className="font-semibold text-emerald-600 hover:underline">salvar</button>
                        </div>
                      </div>
                    ) : hasMedia ? (
                      <>
                        {m.media_type === 'image' && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a href={m.media_url!} target="_blank" rel="noreferrer"><img src={m.media_url!} alt="imagem" className="max-h-72 max-w-full cursor-pointer rounded-lg" /></a>
                        )}
                        {m.media_type === 'audio' && <audio controls src={m.media_url!} className="max-w-full" />}
                        {m.media_type === 'video' && <video controls src={m.media_url!} className="max-h-72 max-w-full rounded-lg" />}
                        {m.media_type === 'document' && <a href={m.media_url!} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-700 underline">📄 {m.text?.replace(/^\[|\]$/g, '') || 'documento'}</a>}
                        {caption && <div className="mt-1">{caption}</div>}
                      </>
                    ) : (
                      m.text || <span className="italic text-gray-400">[mídia]</span>
                    )}
                    <div className="mt-0.5 text-right text-[10px] text-gray-400">{hora(m.sent_at)}</div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {/* BARRA DE ENVIO */}
            <div className="relative border-t border-gray-200 bg-white p-3">
              <input ref={fileRef} type="file" multiple accept="image/*,video/*,application/pdf" onChange={anexar} className="hidden" />

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

      {/* FICHA DO LEAD (padrão BotConversa) */}
      {sel && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
          {/* nome (editável) + enviar fluxo + avatar */}
          <div className="relative flex flex-col items-center px-4 pb-3 pt-5">
            {/* Enviar fluxo (canto superior direito) */}
            <div className="absolute right-3 top-3">
              <button onClick={() => setFichaFlow((v) => !v)} title="Enviar fluxo" className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50">📄 Fluxo</button>
              {fichaFlow && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFichaFlow(false)} />
                  <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500">Enviar fluxo</div>
                    {flows.map((f) => (
                      <button key={f.id} onClick={() => { enviarFluxo(f); setFichaFlow(false) }} className="block w-full border-b border-gray-50 px-3 py-2 text-left text-sm text-gray-700 last:border-0 hover:bg-emerald-50">{f.name}</button>
                    ))}
                    {flows.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">nenhum fluxo</div>}
                  </div>
                </>
              )}
            </div>

            {editName ? (
              <div className="mb-3 w-full px-2">
                <input value={nameVal} onChange={(e) => setNameVal(e.target.value.slice(0, 50))} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') salvarNome() }} className="w-full rounded-lg border border-gray-300 p-2 text-center text-sm outline-none focus:border-emerald-500" />
                <div className="mt-1.5 flex justify-center gap-3 text-xs">
                  <button onClick={() => setEditName(false)} className="text-gray-400 hover:underline">cancelar</button>
                  <button onClick={salvarNome} className="font-semibold text-emerald-600 hover:underline">salvar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setNameVal(sel.name || ''); setEditName(true) }} className="mb-3 flex max-w-full items-center justify-center gap-1.5 text-lg font-bold text-gray-900 transition hover:text-emerald-600" title="Editar nome">
                <span className="truncate">{sel.name?.trim() || sel.phone || 'Sem nome'}</span>
                <span className="text-sm text-gray-400">✏️</span>
              </button>
            )}
            <Avatar name={sel.name} phone={sel.phone} src={card?.avatar_url} className="h-24 w-24 text-2xl" />
          </div>

          {/* Atendimento está [status] [ação] */}
          <div className="flex items-center justify-center gap-3 px-4 pb-4">
            <span className="text-sm text-gray-500">Atendimento está</span>
            {curStatus === 'done' ? (
              <>
                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">Concluído ✓</span>
                <button onClick={() => mudarStatus('handoff')} className="rounded-lg border border-sky-300 px-3 py-1 text-sm font-medium text-sky-600 hover:bg-sky-50">Reabrir ↻</button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-sky-600">Aberto</span>
                <button onClick={() => mudarStatus('done')} className="rounded-lg border border-emerald-300 px-3 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50">Concluir ✓</button>
              </>
            )}
          </div>

          {/* dados */}
          <div className="space-y-3 border-y border-gray-100 px-5 py-4 text-sm">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-gray-500">📱 Telefone</span><span className="text-gray-700" title={card?.phone || sel.phone ? '' : 'O WhatsApp ocultou o número deste contato (LID)'}>{(card?.phone || sel.phone) ? `+${card?.phone ?? sel.phone}` : '— (oculto)'}</span></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-gray-500">✉️ E-mail</span><span className="text-gray-400">—</span></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-gray-500">🗓️ Inscrição</span><span className="text-gray-700">{dataHora(card?.created_at ?? null)}</span></div>
          </div>

          {/* Automação */}
          <div className="px-5 py-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <button onClick={() => setAutoOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
                <span className="flex items-center gap-2 text-sm text-gray-600"><span>🤖</span>Automação está {curStatus === 'active' ? 'ligada' : curStatus === 'handoff' ? 'pausada' : 'concluída'}</span>
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

          {/* Atribuição */}
          <div className="space-y-2 px-5 pb-6">
            {!assignedTo ? (
              <button onClick={() => atribuir(myName)} className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">Atribuir a mim</button>
            ) : (
              <div className="relative">
                <button onClick={() => setAssignOpen((v) => !v)} className="flex w-full items-center justify-center gap-1 rounded-xl border border-sky-400 py-2.5 text-sm font-semibold text-sky-600 hover:bg-sky-50">
                  Atribuído a {assignedTo} <span className={`transition-transform ${assignOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {assignOpen && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                    {assignedTo !== myName && <button onClick={() => atribuir(myName)} className="block w-full border-b border-gray-50 px-3 py-2 text-left text-sm text-sky-600 hover:bg-sky-50">Atribuir a mim ({myName})</button>}
                    {team.filter((a) => (a.name || a.email) && (a.name || a.email) !== assignedTo).map((a) => (
                      <button key={a.id} onClick={() => atribuir(a.name || a.email)} className="block w-full border-b border-gray-50 px-3 py-2 text-left text-sm text-gray-700 last:border-0 hover:bg-gray-50">{a.name || a.email}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {assignedTo && <button onClick={() => atribuir(null)} className="w-full py-1 text-center text-sm font-medium text-red-500 hover:underline">Remover Atribuição</button>}
          </div>

          {/* Observação (nota do contato) */}
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">📝 Observação</span>
              {noteSaved && <span className="text-xs font-medium text-emerald-600">✓ salvo</span>}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} onBlur={salvarNota} rows={4} placeholder="Deixe uma nota sobre este contato…" className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm outline-none focus:border-amber-400" />
            <div className="mt-1 text-right text-[11px] text-gray-400">{note.length}/2000 · salva ao sair do campo</div>
          </div>
        </aside>
      )}

      {/* Modal de encaminhar */}
      {fwdMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFwdMsg(null)}>
          <div className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">Encaminhar para…</h3>
              <button onClick={() => setFwdMsg(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="border-b border-gray-100 p-2">
              <input value={fwdSearch} onChange={(e) => setFwdSearch(e.target.value)} placeholder="Buscar contato…" autoFocus className="w-full rounded-lg bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {convs.filter((c) => { const q = fwdSearch.trim().toLowerCase(); return !q || (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q) }).slice(0, 50).map((c) => (
                <button key={c.contact_id} onClick={() => encaminhar(c.contact_id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-emerald-50">
                  <Avatar name={c.name} phone={c.phone} src={c.avatar_url} className="h-8 w-8 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{c.name?.trim() || c.phone || 'Sem nome'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
