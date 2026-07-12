'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Assistant = { id: string; name: string; description: string; starters: string[] }
type Msg = { role: 'user' | 'assistant'; content: string }

const NAVY = '#1B2B4B'
const GOLD = '#C9A96E'

// Widget flutuante do Assistente de Leads: um balão no canto inferior direito
// que abre um chat compacto — o atendente usa SEM sair da conversa do inbox.
export default function AssistantWidget() {
  const p = usePathname()
  const [open, setOpen] = useState(false)
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loaded, setLoaded] = useState(false)
  const [curId, setCurId] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Não mostra nas telas de login nem na própria página do assistente.
  const HIDE = ['/login', '/cadastro', '/aguardando', '/assistente']
  const hidden = HIDE.some((h) => p === h || p.startsWith(h + '/'))

  useEffect(() => {
    if (!open || loaded) return
    fetch('/api/assistants').then((r) => r.json()).then((d) => { setAssistants(d.assistants || []); setLoaded(true) }).catch(() => setLoaded(true))
  }, [open, loaded])
  useEffect(() => { endRef.current?.scrollIntoView() }, [messages, loading])

  const cur = assistants.find((a) => a.id === curId) || null

  async function enviar(texto?: string) {
    const text = (texto ?? input).trim()
    if (!text || loading || !cur) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, assistantId: cur.id }) })
      const d = await r.json()
      setMessages((m) => [...m, { role: 'assistant', content: r.ok ? (d.reply || '(vazio)') : '⚠️ ' + (d.error || 'Erro.') }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ ' + (e as Error).message }])
    } finally { setLoading(false) }
  }
  async function copiar(text: string, i: number) {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500)
  }

  if (hidden) return null

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] max-h-[75vh] w-[350px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-3 py-2.5" style={{ background: NAVY }}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: GOLD, color: NAVY }}>💡</span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-bold text-white">{cur ? cur.name : 'Assistente de Leads'}</div>
                {cur && <button onClick={() => { setCurId(''); setMessages([]) }} className="text-[10px]" style={{ color: GOLD }}>trocar assistente</button>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {cur && messages.length > 0 && <button onClick={() => setMessages([])} title="Nova conversa" className="rounded p-1 text-white/70 hover:bg-white/10">＋</button>}
              <button onClick={() => setOpen(false)} title="Fechar" className="rounded p-1 text-white/70 hover:bg-white/10">✕</button>
            </div>
          </div>

          {/* Corpo */}
          {!cur ? (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-xs text-gray-500">Escolha o assistente:</p>
              <div className="space-y-1.5">
                {assistants.map((a) => (
                  <button key={a.id} onClick={() => { setCurId(a.id); setMessages([]) }} className="flex w-full items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left transition hover:border-[#C9A96E] hover:bg-amber-50/40">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: NAVY }}>💡</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-semibold text-gray-800">{a.name}</span>
                      {a.description && <span className="block truncate text-[11px] text-gray-400">{a.description}</span>}
                    </span>
                  </button>
                ))}
                {loaded && assistants.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">Nenhum assistente. Crie em “Assistente de Leads”.</div>}
                {!loaded && <div className="p-4 text-center text-xs text-gray-400">carregando…</div>}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto bg-[#f7f8fb] p-3">
              {messages.length === 0 && (
                <div className="pt-2 text-center">
                  <p className="text-xs text-gray-500">Cole a mensagem do paciente 👇</p>
                  {!!cur.starters?.length && (
                    <div className="mt-2 space-y-1.5">
                      {cur.starters.slice(0, 3).map((s, i) => (
                        <button key={i} onClick={() => enviar(s)} className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-[11px] text-gray-600 hover:border-[#C9A96E]">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end"><div className="max-w-[88%] rounded-xl rounded-br-sm px-2.5 py-1.5 text-[12px] text-white" style={{ background: NAVY }}>{m.content}</div></div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[92%] rounded-xl rounded-bl-sm border border-gray-200 bg-white px-2.5 py-2 text-[12px] text-gray-800">
                      <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      <button onClick={() => copiar(m.content, i)} className="mt-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: GOLD, color: copied === i ? '#fff' : NAVY, background: copied === i ? GOLD : 'transparent' }}>{copied === i ? '✓ copiado!' : '📋 Copiar'}</button>
                    </div>
                  </div>
                )
              )}
              {loading && <div className="text-[11px] text-gray-400">gerando…</div>}
              <div ref={endRef} />
            </div>
          )}

          {/* Campo (só com assistente escolhido) */}
          {cur && (
            <div className="border-t border-gray-200 bg-white p-2">
              <div className="flex items-end gap-1.5">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} rows={1} placeholder="Mensagem do paciente…" className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-[12px] outline-none focus:border-[#1B2B4B]" />
                <button onClick={() => enviar()} disabled={loading || !input.trim()} className="flex h-[38px] items-center rounded-xl px-3 text-[12px] font-semibold text-white disabled:opacity-40" style={{ background: NAVY }}>Gerar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Assistente de Leads"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-xl shadow-black/20 ring-4 ring-white transition hover:scale-105"
        style={{ background: NAVY, color: GOLD }}
      >
        {open ? '✕' : '💡'}
      </button>
    </>
  )
}
