'use client'

import { useCallback, useEffect, useState } from 'react'

type Analytics = {
  leadsPeriodo: number
  leadsTotal: number
  emAberto: number
  fechadas: number
  emAtendimento: number
  recebidas: number
  enviadas: number
  tempoMedioRespMin: number | null
  ranking: { atendente: string; respostas: number }[]
}

type Preset = 'dia' | 'semana' | 'mes' | 'ano' | 'custom'

function rangeFor(preset: Preset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  const from = new Date(now)
  if (preset === 'dia') from.setHours(0, 0, 0, 0)
  else if (preset === 'semana') from.setDate(now.getDate() - 7)
  else if (preset === 'mes') from.setMonth(now.getMonth() - 1)
  else if (preset === 'ano') from.setFullYear(now.getFullYear() - 1)
  else if (preset === 'custom') {
    return {
      from: customFrom ? new Date(customFrom + 'T00:00:00') : from,
      to: customTo ? new Date(customTo + 'T23:59:59') : to,
    }
  }
  return { from, to }
}

function fmtTempo(min: number | null) {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${m ? ' ' + m + 'min' : ''}`
}

const TONES: Record<string, { chip: string; num: string }> = {
  emerald: { chip: 'from-emerald-400 to-teal-500 shadow-emerald-200', num: 'text-emerald-600' },
  gray: { chip: 'from-slate-400 to-slate-500 shadow-slate-200', num: 'text-slate-700' },
  amber: { chip: 'from-amber-400 to-orange-500 shadow-amber-200', num: 'text-amber-600' },
  green: { chip: 'from-green-400 to-emerald-500 shadow-green-200', num: 'text-green-600' },
  sky: { chip: 'from-sky-400 to-blue-500 shadow-sky-200', num: 'text-sky-600' },
  indigo: { chip: 'from-indigo-400 to-violet-500 shadow-indigo-200', num: 'text-indigo-600' },
  slate: { chip: 'from-slate-400 to-gray-500 shadow-slate-200', num: 'text-slate-700' },
  violet: { chip: 'from-violet-400 to-purple-500 shadow-violet-200', num: 'text-violet-600' },
}

function Card({ label, value, icon, tone = 'gray', hint }: { label: string; value: string | number; icon: string; tone?: keyof typeof TONES; hint?: string }) {
  const t = TONES[tone] ?? TONES.gray
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/60">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg text-white shadow-md ${t.chip}`}>{icon}</span>
      </div>
      <div className={`mt-3 text-[32px] font-extrabold leading-none tracking-tight ${t.num}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-gray-400">{hint}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [preset, setPreset] = useState<Preset>('dia')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = rangeFor(preset, customFrom, customTo)
    const r = await fetch(`/api/analytics?from=${from.toISOString()}&to=${to.toISOString()}`)
    setData(await r.json())
    setLoading(false)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    load()
  }, [load])

  const presets: { k: Preset; label: string }[] = [
    { k: 'dia', label: 'Hoje' },
    { k: 'semana', label: 'Semana' },
    { k: 'mes', label: 'Mês' },
    { k: 'ano', label: 'Ano' },
    { k: 'custom', label: 'Personalizado' },
  ]

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900">Painel de controle</h1>
          <p className="text-sm text-gray-500">Análise completa do atendimento</p>
        </div>
        {/* filtro de período (segmentado) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {presets.map((p) => (
              <button
                key={p.k}
                onClick={() => setPreset(p.k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${preset === p.k ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-gray-300 p-1.5 outline-none focus:border-emerald-500" />
              <span className="text-gray-400">até</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-gray-300 p-1.5 outline-none focus:border-emerald-500" />
            </div>
          )}
          {loading && <span className="text-xs text-gray-400">carregando…</span>}
        </div>
      </header>

      {data && (
        <>
          {/* cards principais */}
          <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card label="Leads no período" value={data.leadsPeriodo} icon="🌟" tone="emerald" hint="novos contatos" />
            <Card label="Leads no total" value={data.leadsTotal} icon="👥" tone="gray" />
            <Card label="Conversas em aberto" value={data.emAberto} icon="⏳" tone="amber" hint="sem resposta (agora)" />
            <Card label="Concluídas no período" value={data.fechadas} icon="✅" tone="green" />
            <Card label="Tempo médio de resposta" value={fmtTempo(data.tempoMedioRespMin)} icon="⏱️" tone="sky" />
            <Card label="Em atendimento (humano)" value={data.emAtendimento} icon="🙋" tone="indigo" />
            <Card label="Recebidas no período" value={data.recebidas} icon="📥" tone="slate" />
            <Card label="Enviadas no período" value={data.enviadas} icon="📤" tone="violet" />
          </section>

          {/* ranking de atendentes */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-800">🏆 Ranking de atendentes</h2>
              <p className="text-xs text-gray-400">quem mais respondeu no período</p>
            </div>
            {data.ranking.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Sem dados de atendente ainda. (Aparece quando os atendentes responderem pelo inbox.)
              </div>
            ) : (
              <div>
                {data.ranking.map((r, i) => {
                  const max = data.ranking[0].respostas || 1
                  const medal = ['🥇', '🥈', '🥉'][i]
                  return (
                    <div key={r.atendente} className="flex items-center gap-3 border-b border-gray-50 px-5 py-3.5 last:border-0 hover:bg-gray-50/60">
                      <span className="w-7 text-center text-base">{medal ?? <span className="text-sm font-semibold text-gray-400">{i + 1}º</span>}</span>
                      <span className="w-48 truncate text-sm font-medium text-gray-800">{r.atendente}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${(r.respostas / max) * 100}%` }} />
                      </div>
                      <span className="w-16 text-right text-sm font-bold text-gray-700">{r.respostas}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
