'use client'

import { useEffect, useRef, useState } from 'react'
import type { SessionState } from '@/lib/flow-engine'

type Bubble = { from: 'bot' | 'me'; text?: string; image?: string; caption?: string }

export default function Simulador() {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [state, setState] = useState<SessionState | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const status = state?.status ?? 'active'

  async function call(payload: { state: SessionState | null; input: string }) {
    setLoading(true)
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setState(data.state)
      for (const r of data.replies as { text?: string; image?: string; caption?: string }[]) {
        setBubbles((b) => [...b, { from: 'bot', text: r.text, image: r.image, caption: r.caption }])
      }
    } finally {
      setLoading(false)
    }
  }

  // Inicia a conversa ao abrir (bot manda boas-vindas + menu).
  useEffect(() => {
    call({ state: null, input: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles])

  async function send() {
    const text = input.trim()
    if (!text || loading || status !== 'active') return
    setInput('')
    setBubbles((b) => [...b, { from: 'me', text }])
    await call({ state, input: text })
  }

  function reset() {
    setBubbles([])
    setState(null)
    setInput('')
    call({ state: null, input: '' })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Simulador do chatbot</h1>
          <p className="text-xs text-gray-500">Teste a automação como se fosse um paciente</p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          reiniciar
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl bg-[#e5ddd5] p-3">
        {bubbles.map((b, i) => (
          <div
            key={i}
            className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
              b.from === 'bot'
                ? 'self-start rounded-tl-sm bg-white text-gray-800'
                : 'self-end rounded-tr-sm bg-[#dcf8c6] text-gray-800'
            }`}
          >
            {b.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt={b.caption || 'imagem'} className="max-h-52 rounded-lg object-contain" />
                {b.caption && <div className="mt-1">{b.caption}</div>}
              </>
            ) : (
              b.text
            )}
          </div>
        ))}
        {status === 'handoff' && (
          <div className="my-2 self-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
            🙋 Transferido para atendente humano — o bot parou de responder
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={status !== 'active' || loading}
          placeholder={status === 'active' ? 'Digite como paciente…' : 'Atendimento com humano'}
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-gray-100"
        />
        <button
          onClick={send}
          disabled={status !== 'active' || loading}
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          enviar
        </button>
      </div>
    </main>
  )
}
