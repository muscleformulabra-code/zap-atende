'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Conversa = {
  contact_id: string
  name: string | null
  phone: string | null
  last_text: string | null
  last_from_me: boolean | null
  last_sent_at: string | null
}
type Msg = { id: string; from_me: boolean; text: string | null; sent_at: string | null }

function initials(name: string | null, phone: string | null) {
  if (name?.trim()) return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return (phone ?? '?').slice(-2)
}
function hora(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Inbox() {
  const [convs, setConvs] = useState<Conversa[]>([])
  const [sel, setSel] = useState<Conversa | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [quickReplies, setQuickReplies] = useState<{ id: string; shortcut: string; text: string }[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/quick-replies').then((r) => r.json()).then(setQuickReplies).catch(() => {})
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

  useEffect(() => {
    loadConvs()
    const t = setInterval(loadConvs, 5000)
    return () => clearInterval(t)
  }, [loadConvs])

  useEffect(() => {
    if (!sel) return
    loadMsgs(sel.contact_id)
    const t = setInterval(() => loadMsgs(sel.contact_id), 4000)
    return () => clearInterval(t)
  }, [sel, loadMsgs])

  useEffect(() => {
    endRef.current?.scrollIntoView()
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
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* lista de conversas */}
      <aside className="flex w-80 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h1 className="font-bold text-gray-900">Inbox</h1>
          <p className="text-xs text-gray-500">{convs.length} conversas</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.map((c) => {
            const waiting = c.last_from_me === false
            const active = sel?.contact_id === c.contact_id
            return (
              <button
                key={c.contact_id}
                onClick={() => setSel(c)}
                className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-3 text-left hover:bg-gray-50 ${active ? 'bg-emerald-50' : ''}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white">
                  {initials(c.name, c.phone)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium text-gray-800">{c.name?.trim() || c.phone || 'Sem nome'}</span>
                    {waiting && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-400" title="aguardando resposta" />}
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {c.last_from_me ? 'você: ' : ''}{c.last_text || '—'}
                  </div>
                </div>
              </button>
            )
          })}
          {convs.length === 0 && <div className="px-4 py-12 text-center text-sm text-gray-400">Nenhuma conversa ainda.</div>}
        </div>
      </aside>

      {/* conversa aberta */}
      <main className="flex flex-1 flex-col bg-[#e5ddd5]">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Selecione uma conversa à esquerda.</div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-semibold text-white">
                {initials(sel.name, sel.phone)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{sel.name?.trim() || sel.phone}</div>
                <div className="text-xs text-gray-400">{sel.phone}</div>
              </div>
              <button
                onClick={async () => {
                  await fetch('/api/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: sel.contact_id }) })
                  loadConvs()
                }}
                className="ml-auto rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ✓ Concluir
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from_me ? 'self-end rounded-tr-sm bg-[#dcf8c6] text-gray-800' : 'self-start rounded-tl-sm bg-white text-gray-800'
                  }`}
                >
                  {m.text || <span className="italic text-gray-400">[mídia]</span>}
                  <div className="mt-0.5 text-right text-[10px] text-gray-400">{hora(m.sent_at)}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="relative flex items-center gap-2 border-t border-gray-200 bg-white p-3">
              {qrMatches.length > 0 && (
                <div className="absolute bottom-16 left-3 z-10 w-96 max-w-[80%] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="border-b border-gray-100 px-3 py-1.5 text-[11px] font-medium text-gray-400">Respostas rápidas</div>
                  {qrMatches.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setText(q.text)}
                      className="flex w-full flex-col items-start border-b border-gray-50 px-3 py-2 text-left last:border-0 hover:bg-emerald-50"
                    >
                      <span className="font-mono text-xs text-emerald-700">/{q.shortcut}</span>
                      <span className="truncate text-xs text-gray-600">{q.text}</span>
                    </button>
                  ))}
                </div>
              )}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Escreva uma mensagem… (ou /atalho)"
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button onClick={send} disabled={sending} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                enviar
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
