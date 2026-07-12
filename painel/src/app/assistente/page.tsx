'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

const NAVY = '#1B2B4B'
const GOLD = '#C9A96E'

export default function Assistente() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function enviar() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const d = await r.json()
      if (!r.ok) {
        setMessages((m) => [...m, { role: 'assistant', content: '⚠️ ' + (d.error || 'Erro ao gerar a resposta.') }])
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: d.reply || '(resposta vazia)' }])
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Falha de conexão: ' + (e as Error).message }])
    } finally {
      setLoading(false)
    }
  }

  async function copiar(text: string, i: number) {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(i)
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4" style={{ background: NAVY }}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: GOLD, color: NAVY }}>💡</span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-white">Assistente de Leads</div>
            <div className="text-xs" style={{ color: GOLD }}>IA de apoio — sugere a resposta pro paciente</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10">
            ＋ Nova conversa
          </button>
        )}
      </div>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: NAVY, color: GOLD }}>💡</span>
              <h2 className="text-lg font-bold" style={{ color: NAVY }}>Cole a mensagem do paciente</h2>
              <p className="mt-2 text-sm text-gray-500">A IA sugere uma resposta pronta, no tom da clínica, já puxando pro agendamento. É só <b>copiar e colar</b> no WhatsApp.</p>
              <div className="mt-4 rounded-xl bg-gray-50 p-3 text-left text-xs text-gray-400">
                Ex.: <i>&quot;Oi, quanto custa uma limpeza?&quot;</i> → a IA devolve uma resposta acolhedora que explica e convida a agendar uma avaliação.
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white shadow-sm" style={{ background: NAVY }}>
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>mensagem do paciente</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
                    <span>✨ resposta sugerida</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  <button onClick={() => copiar(m.content, i)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition" style={{ borderColor: GOLD, color: copied === i ? '#fff' : NAVY, background: copied === i ? GOLD : 'transparent' }}>
                    {copied === i ? '✓ copiado!' : '📋 Copiar'}
                  </button>
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: GOLD, animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: GOLD, animationDelay: '120ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: GOLD, animationDelay: '240ms' }} />
                <span className="ml-1">gerando resposta…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Campo de digitação */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Cole aqui a mensagem que o paciente enviou…"
            className="max-h-40 min-h-[46px] flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#1B2B4B] focus:ring-2 focus:ring-[#1B2B4B]/10"
          />
          <button
            onClick={enviar}
            disabled={loading || !input.trim()}
            className="flex h-[46px] items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: NAVY }}
          >
            {loading ? '…' : 'Gerar'} <span style={{ color: GOLD }}>➤</span>
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-gray-400">Ferramenta de apoio — a resposta NÃO é enviada automaticamente. Você copia e cola no WhatsApp.</p>
      </div>
    </div>
  )
}
