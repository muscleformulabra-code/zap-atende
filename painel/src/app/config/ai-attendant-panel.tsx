'use client'

import { useEffect, useState } from 'react'
import { AI_MODELS, type AiAttendant } from '@/lib/ai-attendant'

type DayKey = 'monFri' | 'sat' | 'sun'
const DAYS: { k: DayKey; label: string }[] = [
  { k: 'monFri', label: 'Segunda a sexta' },
  { k: 'sat', label: 'Sábado' },
  { k: 'sun', label: 'Domingo' },
]

const input = 'w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500'
const label = 'text-xs font-semibold text-gray-600'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <div className="font-semibold text-gray-800">{title}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
      {children}
    </section>
  )
}

// Lista simples de textos (ex.: dados pra agendar, temas sensíveis).
function StringList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={input} placeholder={placeholder} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="shrink-0 rounded-lg border border-gray-200 px-2 text-gray-400 hover:bg-red-50 hover:text-red-500">✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])} className="text-xs font-semibold text-emerald-600 hover:underline">+ adicionar</button>
    </div>
  )
}

export default function AiAttendantPanel() {
  const [c, setC] = useState<AiAttendant | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading')

  useEffect(() => {
    fetch('/api/ai-attendant').then((r) => r.json()).then((d) => { setC(d); setStatus('ready') }).catch(() => setStatus('ready'))
  }, [])

  function up<K extends keyof AiAttendant>(k: K, v: AiAttendant[K]) { setC((s) => (s ? { ...s, [k]: v } : s)) }

  async function save() {
    if (!c) return
    setStatus('saving')
    await fetch('/api/ai-attendant', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
    setStatus('saved'); setTimeout(() => setStatus('ready'), 1500)
  }

  if (!c) return <div className="text-sm text-gray-400">carregando…</div>

  return (
    <div className="space-y-5">
      {/* Liga/desliga + salvar */}
      <section className={`rounded-2xl border p-5 shadow-sm ${c.enabled ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3">
            <button onClick={() => up('enabled', !c.enabled)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${c.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${c.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <div>
              <div className="font-semibold text-gray-800">🤖 Atendimento por IA {c.enabled ? 'ligado' : 'desligado'}</div>
              <div className="text-xs text-gray-500">Quando ligado, a {c.persona.name || 'IA'} responde os pacientes automaticamente e só passa pro atendente quando necessário.</div>
            </div>
          </label>
          <button onClick={save} disabled={status === 'saving'} className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
            {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'Salvar'}
          </button>
        </div>
      </section>

      <Section title="Persona" hint="Quem é a IA e como ela fala.">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div><div className={label}>Nome</div><input value={c.persona.name} onChange={(e) => up('persona', { ...c.persona, name: e.target.value })} className={`mt-1 ${input}`} /></div>
          <div><div className={label}>Tom de voz</div><textarea value={c.persona.tone} onChange={(e) => up('persona', { ...c.persona, tone: e.target.value })} rows={2} className={`mt-1 ${input} resize-y`} /></div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><div className={label}>Modelo de IA</div>
            <select value={c.model} onChange={(e) => up('model', e.target.value)} className={`mt-1 ${input}`}>{AI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <div><div className={label}>Criatividade ({c.temperature.toFixed(1)})</div>
            <input type="range" min={0} max={1} step={0.1} value={c.temperature} onChange={(e) => up('temperature', Number(e.target.value))} className="mt-3 w-full" />
          </div>
        </div>
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">⏱️ Agrupar mensagens rápidas:</span>
            <span className="text-gray-500">esperar</span>
            <input type="number" min={1} max={60} value={c.groupWaitSeconds} onChange={(e) => up('groupWaitSeconds', Math.max(1, Math.min(60, Number(e.target.value) || 8)))} className="w-20 rounded-lg border border-gray-300 p-1.5 text-center" />
            <span className="text-gray-500">segundos antes de responder</span>
          </div>
          <div className="text-xs text-gray-400">Se o paciente manda várias mensagens seguidas, a IA espera ele terminar e responde 1 vez só (evita parecer spam). O tempo reinicia a cada nova mensagem.</div>
          <label className="flex items-center gap-2 pt-1 text-sm text-gray-700">
            <input type="checkbox" checked={c.transcribeAudio} onChange={(e) => up('transcribeAudio', e.target.checked)} className="h-4 w-4 rounded" />
            🎤 A IA <b>ouve e entende áudios</b> do paciente (transcrição automática)
          </label>
        </div>
      </Section>

      <Section title="Boas-vindas (pré-atendimento)" hint="A primeira mensagem que a Sofia usa ao receber o paciente. Ela adapta com naturalidade.">
        <textarea value={c.welcomeMessage} onChange={(e) => up('welcomeMessage', e.target.value)} rows={3} placeholder="Ex.: Olá! Seja bem-vindo(a) à Ricco Odontologia…" className={`${input} resize-y`} />
      </Section>

      <Section title="Clínica" hint="Informações que a IA usa como fonte da verdade.">
        <div className="space-y-3">
          <div><div className={label}>Nome da clínica</div><input value={c.clinic.name} onChange={(e) => up('clinic', { ...c.clinic, name: e.target.value })} className={`mt-1 ${input}`} /></div>
          <div><div className={label}>Endereço</div><input value={c.clinic.address} onChange={(e) => up('clinic', { ...c.clinic, address: e.target.value })} className={`mt-1 ${input}`} /></div>
          <div><div className={label}>Formas de pagamento / convênio</div><textarea value={c.clinic.payment} onChange={(e) => up('clinic', { ...c.clinic, payment: e.target.value })} rows={2} className={`mt-1 ${input} resize-y`} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={c.clinic.freeEvaluation} onChange={(e) => up('clinic', { ...c.clinic, freeEvaluation: e.target.checked })} className="h-4 w-4 rounded" />
            A primeira avaliação é <b>gratuita</b> (a IA usa isso como gancho)
          </label>
          <div><div className={label}>⚠️ Aviso importante (ex.: inauguração, férias) — a IA repassa isso</div>
            <textarea value={c.clinic.operationalNote} onChange={(e) => up('clinic', { ...c.clinic, operationalNote: e.target.value })} rows={2} placeholder="Ex.: Inauguramos dia 20/07 — já pode agendar sua avaliação!" className={`mt-1 ${input} resize-y`} />
          </div>
        </div>
      </Section>

      <Section title="Horários de atendimento" hint="Usado pra saber se está aberto (aviso de fora do horário).">
        <div className="space-y-2">
          {DAYS.map(({ k, label: dl }) => {
            const slot = c.hours[k]
            const open = !!slot
            return (
              <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-36 text-gray-600">{dl}</span>
                <button onClick={() => up('hours', { ...c.hours, [k]: open ? null : ['08:00', '17:00'] })} className={`rounded-full px-3 py-1 text-xs font-semibold ${open ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{open ? 'aberto' : 'fechado'}</button>
                {open && (
                  <>
                    <input type="time" value={slot![0]} onChange={(e) => up('hours', { ...c.hours, [k]: [e.target.value, slot![1]] })} className="rounded-lg border border-gray-300 p-1.5 text-sm" />
                    <span className="text-gray-400">às</span>
                    <input type="time" value={slot![1]} onChange={(e) => up('hours', { ...c.hours, [k]: [slot![0], e.target.value] })} className="rounded-lg border border-gray-300 p-1.5 text-sm" />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Profissionais" hint="A equipe que a IA conhece.">
        <div className="space-y-2">
          {c.professionals.map((p, i) => (
            <div key={i} className="flex gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <input value={p.name} onChange={(e) => up('professionals', c.professionals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Nome" className={input} />
                <input value={p.specialty} onChange={(e) => up('professionals', c.professionals.map((x, j) => (j === i ? { ...x, specialty: e.target.value } : x)))} placeholder="Especialidade" className={input} />
                <input value={p.notes || ''} onChange={(e) => up('professionals', c.professionals.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} placeholder="Observação" className={input} />
              </div>
              <button onClick={() => up('professionals', c.professionals.filter((_, j) => j !== i))} className="shrink-0 rounded-lg border border-gray-200 px-2 text-gray-400 hover:bg-red-50 hover:text-red-500">✕</button>
            </div>
          ))}
          <button onClick={() => up('professionals', [...c.professionals, { name: '', specialty: '', notes: '' }])} className="text-xs font-semibold text-emerald-600 hover:underline">+ adicionar profissional</button>
        </div>
      </Section>

      <Section title="Serviços" hint="Procedimentos que a clínica oferece.">
        <div className="space-y-2">
          {c.services.map((sv, i) => (
            <div key={i} className="flex gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-[220px_1fr]">
                <input value={sv.name} onChange={(e) => up('services', c.services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Serviço" className={input} />
                <input value={sv.desc || ''} onChange={(e) => up('services', c.services.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} placeholder="Descrição curta" className={input} />
              </div>
              <button onClick={() => up('services', c.services.filter((_, j) => j !== i))} className="shrink-0 rounded-lg border border-gray-200 px-2 text-gray-400 hover:bg-red-50 hover:text-red-500">✕</button>
            </div>
          ))}
          <button onClick={() => up('services', [...c.services, { name: '', desc: '' }])} className="text-xs font-semibold text-emerald-600 hover:underline">+ adicionar serviço</button>
        </div>
      </Section>

      <Section title="Perguntas frequentes" hint="Respostas prontas que a IA reaproveita.">
        <div className="space-y-2">
          {c.faq.map((f, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-2">
              <div className="flex gap-2">
                <input value={f.q} onChange={(e) => up('faq', c.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="Pergunta" className={input} />
                <button onClick={() => up('faq', c.faq.filter((_, j) => j !== i))} className="shrink-0 rounded-lg border border-gray-200 px-2 text-gray-400 hover:bg-red-50 hover:text-red-500">✕</button>
              </div>
              <textarea value={f.a} onChange={(e) => up('faq', c.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="Resposta" rows={2} className={`mt-2 ${input} resize-y`} />
            </div>
          ))}
          <button onClick={() => up('faq', [...c.faq, { q: '', a: '' }])} className="text-xs font-semibold text-emerald-600 hover:underline">+ adicionar pergunta</button>
        </div>
      </Section>

      <Section title="Política de preço" hint="Como a IA lida com valores.">
        <textarea value={c.pricingPolicy} onChange={(e) => up('pricingPolicy', e.target.value)} rows={3} className={`${input} resize-y`} />
      </Section>

      <Section title="Quando passar pro atendente humano" hint="As duas únicas situações em que a IA para e chama a equipe.">
        <div className="space-y-4">
          <div>
            <div className={label}>🗓️ Dados que, quando completos, passam pra equipe finalizar o agendamento</div>
            <div className="mt-2"><StringList items={c.handoff.scheduleFields} onChange={(v) => up('handoff', { ...c.handoff, scheduleFields: v })} placeholder="Ex.: Nome completo" /></div>
          </div>
          <div>
            <div className={label}>⚠️ Assuntos sensíveis (passa na hora)</div>
            <div className="mt-2"><StringList items={c.handoff.sensitiveTopics} onChange={(v) => up('handoff', { ...c.handoff, sensitiveTopics: v })} placeholder="Ex.: dor forte ou urgência" /></div>
          </div>
          <div><div className={label}>Frase-ponte ao entregar pro atendente</div><textarea value={c.handoff.bridgeMessage} onChange={(e) => up('handoff', { ...c.handoff, bridgeMessage: e.target.value })} rows={2} className={`mt-1 ${input} resize-y`} /></div>
          <div><div className={label}>Mensagem quando precisar passar FORA do horário</div><textarea value={c.handoff.offHoursMessage} onChange={(e) => up('handoff', { ...c.handoff, offHoursMessage: e.target.value })} rows={2} className={`mt-1 ${input} resize-y`} /></div>
        </div>
      </Section>

      <Section title="Instruções extras (opcional)" hint="Qualquer regra a mais que você queira dar pra IA.">
        <textarea value={c.extraInstructions} onChange={(e) => up('extraInstructions', e.target.value)} rows={3} placeholder="Deixe em branco se não precisar." className={`${input} resize-y`} />
      </Section>

      <div className="flex justify-end">
        <button onClick={save} disabled={status === 'saving'} className="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'Salvar tudo'}
        </button>
      </div>
    </div>
  )
}
