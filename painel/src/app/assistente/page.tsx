'use client'

import { useEffect, useRef, useState } from 'react'

type FileMeta = { name: string; url: string; chars: number }
type Assistant = {
  id: string; name: string; description: string; instructions: string; context: string
  model: string; temperature: number; starters: string[]; files: FileMeta[]
}
type Msg = { role: 'user' | 'assistant'; content: string }

const NAVY = '#1B2B4B'
const GOLD = '#C9A96E'

export default function Assistente() {
  const [mode, setMode] = useState<'chat' | 'config'>('chat')
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [models, setModels] = useState<string[]>([])
  const [curId, setCurId] = useState<string>('')
  const [pickOpen, setPickOpen] = useState(false)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const cur = assistants.find((a) => a.id === curId) || null

  async function load(selectId?: string) {
    const d = await (await fetch('/api/assistants')).json()
    const list: Assistant[] = d.assistants || []
    setAssistants(list); setModels(d.models || [])
    setCurId((prev) => selectId || (list.find((a) => a.id === prev)?.id ?? list[0]?.id ?? ''))
  }
  useEffect(() => { load() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function novoAssistente() {
    const name = prompt('Nome do novo assistente (ex.: Ricco Odontologia):')
    if (!name || !name.trim()) return
    const d = await (await fetch('/api/assistants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })).json()
    setPickOpen(false)
    await load(d.assistant?.id)
    setMessages([]); setMode('config')
  }

  async function enviar(texto?: string) {
    const text = (texto ?? input).trim()
    if (!text || loading || !cur) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, assistantId: cur.id }) })
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

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho com seletor de assistente */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6" style={{ background: NAVY }}>
        <div className="relative">
          <button onClick={() => setPickOpen((s) => !s)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/10">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg" style={{ background: GOLD, color: NAVY }}>💡</span>
            <span className="text-left leading-tight">
              <span className="block text-[14px] font-bold text-white">{cur?.name || 'Assistente'}</span>
              <span className="block text-[11px]" style={{ color: GOLD }}>trocar assistente ▾</span>
            </span>
          </button>
          {pickOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickOpen(false)} />
              <div className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="max-h-72 overflow-y-auto py-1">
                  {assistants.map((a) => (
                    <button key={a.id} onClick={() => { setCurId(a.id); setPickOpen(false); setMessages([]); setMode('chat') }} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 ${a.id === curId ? 'bg-emerald-50/60' : ''}`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: NAVY }}>💡</span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm font-semibold text-gray-800">{a.name}</span>
                        {a.description && <span className="block truncate text-[11px] text-gray-400">{a.description}</span>}
                      </span>
                      {a.id === curId && <span className="text-emerald-500">✓</span>}
                    </button>
                  ))}
                </div>
                <button onClick={novoAssistente} className="w-full border-t border-gray-100 py-2.5 text-sm font-semibold text-white" style={{ background: NAVY }}>＋ Novo assistente</button>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'chat' && messages.length > 0 && (
            <button onClick={() => setMessages([])} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10">＋ Nova conversa</button>
          )}
          <button onClick={() => setMode((m) => (m === 'chat' ? 'config' : 'chat'))} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10">
            {mode === 'chat' ? '⚙️ Configurar' : '← Voltar ao chat'}
          </button>
        </div>
      </div>

      {mode === 'config' && cur ? (
        <ConfigForm key={cur.id} assistant={cur} models={models} onSaved={() => load(cur.id).then(() => setMode('chat'))} onDeleted={() => load()} onChanged={() => load(cur.id)} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 && (
                <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                  <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: NAVY, color: GOLD }}>💡</span>
                  <h2 className="text-lg font-bold" style={{ color: NAVY }}>{cur?.name || 'Assistente'}</h2>
                  <p className="mt-2 text-sm text-gray-500">{cur?.description || 'Cole a mensagem do paciente e receba uma resposta pronta pra copiar e colar no WhatsApp.'}</p>
                  {!!cur?.starters?.length && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {cur.starters.map((s, i) => (
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

// ── Tela de configuração de um assistente ──
function ConfigForm({ assistant, models, onSaved, onDeleted, onChanged }: { assistant: Assistant; models: string[]; onSaved: () => void; onDeleted: () => void; onChanged: () => void }) {
  const [f, setF] = useState<Assistant>(assistant)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const up = (patch: Partial<Assistant>) => setF((c) => ({ ...c, ...patch }))

  async function salvar() {
    setBusy(true); setMsg('')
    try {
      const { id, name, description, instructions, context, model, temperature, starters } = f
      const r = await fetch('/api/assistants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, description, instructions, context, model, temperature, starters }) })
      if (!r.ok) throw new Error((await r.json()).error || 'erro')
      onSaved()
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setBusy(false) }
  }

  async function excluir() {
    if (!confirm(`Excluir o assistente "${f.name}"? Não dá pra desfazer.`)) return
    await fetch(`/api/assistants?id=${f.id}`, { method: 'DELETE' })
    onDeleted()
  }

  async function subirArquivo(file: File) {
    setUploading(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('assistantId', f.id)
      const r = await fetch('/api/assistant-files', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'falha no upload')
      up({ files: d.files })
      if (d.warn) setMsg('⚠️ ' + d.warn)
      onChanged()
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setUploading(false) }
  }

  async function removerArquivo(i: number) {
    const r = await fetch(`/api/assistant-files?assistantId=${f.id}&index=${i}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) { up({ files: d.files }); onChanged() }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Configurar assistente</h2>
          <div className="flex gap-2">
            <button onClick={excluir} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50">Excluir</button>
            <button onClick={salvar} disabled={busy} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: NAVY }}>{busy ? 'salvando…' : 'Salvar'}</button>
          </div>
        </div>

        <Field label="Nome do assistente"><input value={f.name} onChange={(e) => up({ name: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#1B2B4B]" /></Field>
        <Field label="Descrição" hint="Uma linha do que ele faz (aparece no seletor e na tela inicial)."><input value={f.description} onChange={(e) => up({ description: e.target.value })} placeholder="Ex.: Central de leads da Ricco Odontologia" className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#1B2B4B]" /></Field>
        <Field label="Instruções do assistente" hint="O 'cérebro'. Cole aqui o seu prompt (tom, objetivo, regras)."><textarea value={f.instructions} onChange={(e) => up({ instructions: e.target.value })} rows={12} className="w-full rounded-lg border border-gray-300 p-2.5 font-mono text-[13px] leading-relaxed outline-none focus:border-[#1B2B4B]" /></Field>
        <Field label="Contexto (opcional)" hint="Informações fixas digitadas: preços, endereço, convênios…"><textarea value={f.context} onChange={(e) => up({ context: e.target.value })} rows={5} className="w-full rounded-lg border border-gray-300 p-2.5 text-[13px] outline-none focus:border-[#1B2B4B]" /></Field>

        {/* Conhecimento (arquivos) */}
        <Field label="Conhecimento" hint="Suba arquivos (PDF/TXT/CSV com texto). A IA usa o conteúdo como base. PDFs escaneados (imagem) não têm texto pra ler.">
          <div className="space-y-2">
            {f.files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                <span className="text-lg">📄</span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{file.name}</span>
                <span className="text-[11px] text-gray-400">{file.chars > 0 ? `${file.chars} caracteres` : 'sem texto'}</span>
                <button onClick={() => removerArquivo(i)} className="text-gray-400 hover:text-red-500">✕</button>
              </div>
            ))}
            <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,.md,text/*,application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) subirArquivo(file); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {uploading ? 'enviando…' : '＋ Carregar arquivo'}
            </button>
          </div>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Modelo GPT" hint="Escolha ou digite outro.">
            <input list="models" value={f.model} onChange={(e) => up({ model: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#1B2B4B]" />
            <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label={`Temperatura: ${f.temperature.toFixed(1)}`} hint="0 = objetivo · 1 = criativo">
            <input type="range" min={0} max={1} step={0.1} value={f.temperature} onChange={(e) => up({ temperature: Number(e.target.value) })} className="w-full accent-[#1B2B4B]" />
          </Field>
        </div>

        <Field label="Quebra-gelos" hint="Exemplos que aparecem na tela vazia.">
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
