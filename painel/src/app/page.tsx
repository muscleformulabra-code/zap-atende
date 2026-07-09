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

function Card({ label, value, icon, iconBg, accent, hint }: { label: string; value: string | number; icon: string; iconBg: string; accent?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${iconBg}`}>{icon}</span>
      </div>
      <div className={`mt-3 text-3xl font-bold ${accent ?? 'text-gray-800'}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel de controle</h1>
        <p className="text-sm text-gray-500">Análise completa do atendimento</p>
      </header>

      {/* filtro de período */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.k}
            onClick={() => setPreset(p.k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${preset === p.k ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-gray-300 p-1.5" />
            <span className="text-gray-400">até</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-gray-300 p-1.5" />
          </div>
        )}
        {loading && <span className="text-xs text-gray-400">carregando…</span>}
      </div>

      {data && (
        <>
          {/* cards principais */}
          <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card label="Leads no período" value={data.leadsPeriodo} icon="🌟" iconBg="bg-emerald-100" accent="text-emerald-600" hint="novos contatos" />
            <Card label="Leads no total" value={data.leadsTotal} icon="👥" iconBg="bg-gray-100" />
            <Card label="Conversas em aberto" value={data.emAberto} icon="⏳" iconBg="bg-amber-100" accent="text-amber-600" hint="sem resposta (agora)" />
            <Card label="Concluídas no período" value={data.fechadas} icon="✅" iconBg="bg-green-100" accent="text-green-600" />
            <Card label="Tempo médio de resposta" value={fmtTempo(data.tempoMedioRespMin)} icon="⏱️" iconBg="bg-sky-100" accent="text-sky-600" />
            <Card label="Em atendimento (humano)" value={data.emAtendimento} icon="🙋" iconBg="bg-indigo-100" accent="text-indigo-600" />
            <Card label="Recebidas no período" value={data.recebidas} icon="📥" iconBg="bg-slate-100" accent="text-slate-700" />
            <Card label="Enviadas no período" value={data.enviadas} icon="📤" iconBg="bg-violet-100" accent="text-violet-600" />
          </section>

          {/* ranking de atendentes */}
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-800">Ranking de atendentes</h2>
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
                  return (
                    <div key={r.atendente} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
                      <span className="w-6 text-sm font-semibold text-gray-400">{i + 1}º</span>
                      <span className="w-48 truncate text-sm text-gray-800">{r.atendente}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(r.respostas / max) * 100}%` }} />
                      </div>
                      <span className="w-16 text-right text-sm font-medium text-gray-700">{r.respostas}</span>
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
