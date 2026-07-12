'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }
type Config = { name: string; instructions: string; context: string; model: string; temperature: number; starters: string[] }

const NAVY = '#1B2B4B'
const GOLD = '#C9A96E'

export default function Assistente() {
  const [mode, setMode] = useState<'chat' | 'config'>('chat')
  const [cfg, setCfg] = useState<Config | null>(null)
  const [models, setModels] = useState<string[]>([])

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  async function loadCfg() {
    const d = await (await fetch('/api/assistant-config')).json()
    setCfg(d.config); setModels(d.models || [])
  }
  useEffect(() => { loadCfg() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function enviar(texto?: string) {
    const text = (texto ?? input).trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) })
      const d = await r.json()
      setMessages((m) => [...m, { role: 'assistant', content: r.ok ? (d.reply || '(resposta vazia)') : '⚠️ ' + (d.error || 'Erro ao gerar.') }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Falha de conexão: ' + (e as Error).message }])
    } finally { setLoading(false) }
  }

  async function copiar(text: string, i: number) {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500)
  }

  const name = cfg?.name || 'Assistente de Leads'

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-6 py-4" style={{ background: NAVY }}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: GOLD, color: NAVY }}>💡</span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-white">{name}</div>
            <div className="text-xs" style={{ color: GOLD }}>IA de apoio — sugere a resposta pro paciente</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'chat' && messages.length > 0 && (
            <button onClick={() => setMessages([])} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10">＋ Nova conversa</button>
          )}
          <button onClick={() => setMode((m) => (m === 'chat' ? 'config' : 'chat'))} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10">
            {mode === 'chat' ? '⚙️ Configurar' : '← Voltar ao chat'}
          </button>
        </div>
      </div>

      {mode === 'config' ? (
        <ConfigForm cfg={cfg} models={models} onSaved={(c) => { setCfg(c); setMode('chat') }} />
      ) : (
        <>
          {/* Histórico */}
          <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 && (
                <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                  <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: NAVY, color: GOLD }}>💡</span>
                  <h2 className="text-lg font-bold" style={{ color: NAVY }}>Cole a mensagem do paciente</h2>
                  <p className="mt-2 text-sm text-gray-500">A IA sugere uma resposta pronta, no tom da clínica, já puxando pro agendamento. É só <b>copiar e colar</b> no WhatsApp.</p>
                  {!!cfg?.starters?.length && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {cfg.starters.map((s, i) => (
                        <button key={i} onClick={() => enviar(s)} className="rounded-xl border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 transition hover:border-[#C9A96E] hover:bg-amber-50/40">{s}</button>
                      ))}
                    </div>
                  )}
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
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>✨ resposta sugerida</div>
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
                    <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: GOLD }} />
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
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} rows={1} placeholder="Cole aqui a mensagem que o paciente enviou…" className="max-h-40 min-h-[46px] flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#1B2B4B] focus:ring-2 focus:ring-[#1B2B4B]/10" />
              <button onClick={() => enviar()} disabled={loading || !input.trim()} className="flex h-[46px] items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition disabled:opacity-40" style={{ background: NAVY }}>
                {loading ? '…' : 'Gerar'} <span style={{ color: GOLD }}>➤</span>
              </button>
            </div>
            <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-gray-400">Ferramenta de apoio — a resposta NÃO é enviada automaticamente. Você copia e cola no WhatsApp.</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tela de configuração do assistente (igual editor de GPT) ──
function ConfigForm({ cfg, models, onSaved }: { cfg: Config | null; models: string[]; onSaved: (c: Config) => void }) {
  const [f, setF] = useState<Config | null>(cfg)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { setF(cfg) }, [cfg])
  if (!f) return <div className="flex-1 p-8 text-sm text-gray-400">carregando…</div>

  const up = (patch: Partial<Config>) => setF((c) => (c ? { ...c, ...patch } : c))

  async function salvar() {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/assistant-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: f }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'erro')
      onSaved(f!)
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Configurar assistente</h2>
          <button onClick={salvar} disabled={busy} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: NAVY }}>{busy ? 'salvando…' : 'Salvar'}</button>
        </div>

        <Field label="Nome do assistente" hint="Aparece no topo da tela.">
          <input value={f.name} onChange={(e) => up({ name: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#1B2B4B]" />
        </Field>

        <Field label="Instruções do assistente" hint="O 'cérebro' — como ele deve responder (tom, objetivo, regras). Cole aqui o seu prompt.">
          <textarea value={f.instructions} onChange={(e) => up({ instructions: e.target.value })} rows={12} className="w-full rounded-lg border border-gray-300 p-2.5 font-mono text-[13px] leading-relaxed outline-none focus:border-[#1B2B4B]" />
        </Field>

        <Field label="Contexto da clínica (opcional)" hint="Informações fixas: preços, endereço, convênios, procedimentos, horários… A IA usa como base.">
          <textarea value={f.context} onChange={(e) => up({ context: e.target.value })} rows={6} placeholder="Ex.: Ricco Odontologia — Taguatinga-DF. Avaliação gratuita. Aparelho a partir de R$..., etc." className="w-full rounded-lg border border-gray-300 p-2.5 text-[13px] leading-relaxed outline-none focus:border-[#1B2B4B]" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Modelo GPT" hint="Escolha ou digite outro.">
            <input list="models" value={f.model} onChange={(e) => up({ model: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#1B2B4B]" />
            <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label={`Temperatura: ${f.temperature.toFixed(1)}`} hint="0 = objetivo/consistente · 1 = mais criativo">
            <input type="range" min={0} max={1} step={0.1} value={f.temperature} onChange={(e) => up({ temperature: Number(e.target.value) })} className="w-full accent-[#1B2B4B]" />
          </Field>
        </div>

        <Field label="Quebra-gelos" hint="Exemplos que aparecem na tela vazia (mensagens típicas de paciente).">
          <div className="space-y-2">
            {f.starters.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input value={s} onChange={(e) => up({ starters: f.starters.map((x, j) => (j === i ? e.target.value : x)) })} className="flex-1 rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-[#1B2B4B]" />
                <button onClick={() => up({ starters: f.starters.filter((_, j) => j !== i) })} className="rounded-lg px-3 text-gray-400 hover:text-red-500">✕</button>
              </div>
            ))}
            <button onClick={() => up({ starters: [...f.starters, ''] })} className="text-sm font-medium text-[#1B2B4B] hover:underline">+ adicionar exemplo</button>
          </div>
        </Field>

        {msg && <div className="text-sm text-gray-600">{msg}</div>}
        <div className="flex justify-end pb-6">
          <button onClick={salvar} disabled={busy} className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: NAVY }}>{busy ? 'salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold text-gray-800">{label}</div>
      {hint && <div className="mb-1.5 text-xs text-gray-400">{hint}</div>}
      {children}
    </div>
  )
}
