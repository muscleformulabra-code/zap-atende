'use client'

import { useCallback, useEffect, useState } from 'react'

type WaitingLead = { contact_id: string; name: string | null; phone: string | null; last_text: string | null; waitingMin: number }
type AttendantStat = { atendente: string; respostas: number; tempoRespMin: number | null }
type DayPoint = { date: string; novosContatos: number; conversasUnicas: number; abertas: number; encerradas: number }
type MemberStat = { name: string; respondido: number; fechado: number; primeiraMedianaSeg: number | null; primeiraMediaSeg: number | null; fechamentoMedianaSeg: number | null; fechamentoMediaSeg: number | null }
type Analytics = {
  leadsPeriodo: number
  leadsTotal: number
  emAberto: number
  fechadas: number
  emAtendimento: number
  recebidas: number
  enviadas: number
  tempoMedioRespMin: number | null
  taxaResposta: number | null
  waiting: WaitingLead[]
  ranking: AttendantStat[]
  series: DayPoint[]
  members: MemberStat[]
}

// "Xh Ym" / "Xm Ys" a partir de segundos.
function fmtDur(seg: number | null): string {
  if (seg == null) return '—'
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = Math.round(seg % 60)
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}

const METRICS: { k: keyof DayPoint; label: string }[] = [
  { k: 'novosContatos', label: 'Novos contatos' },
  { k: 'conversasUnicas', label: 'Conversas únicas' },
  { k: 'abertas', label: 'Conversas abertas' },
  { k: 'encerradas', label: 'Conversas encerradas' },
]

// Gráfico de barras simples (SVG) das estatísticas por dia.
// Altura FIXA em px (nunca "explode" com poucos dados) e rolagem horizontal
// quando há muitos dias.
function BarChart({ series, metric }: { series: DayPoint[]; metric: keyof DayPoint }) {
  if (!series.length) return <div className="py-8 text-center text-sm text-gray-400">Sem dados no período.</div>
  const vals = series.map((d) => Number(d[metric]) || 0)
  const max = Math.max(1, ...vals)
  const H = 240, padL = 34, padTop = 24, padBottom = 30
  const slot = 52
  const W = Math.max(series.length * slot + padL + 8, 260)
  const plotH = H - padTop - padBottom
  const showEvery = series.length > 20 ? Math.ceil(series.length / 15) : 1
  const ticks = max <= 2 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, max / 2, max]
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%' }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
        {ticks.map((t) => { const y = padTop + plotH * (1 - t / max); return (<g key={t}><line x1={padL} y1={y} x2={W - 6} y2={y} stroke="#eef1f5" /><text x={2} y={y + 3.5} fontSize="10" fill="#9ca3af">{Math.round(t)}</text></g>) })}
        {series.map((d, i) => {
          const v = Number(d[metric]) || 0
          const bh = v > 0 ? Math.max(plotH * (v / max), 2) : 0
          const w = slot * 0.5
          const x = padL + i * slot + (slot - w) / 2
          const y = padTop + plotH - bh
          const lbl = d.date.slice(5).replace('-', '/')
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={w} height={bh} rx={4} fill="url(#barGrad)"><title>{lbl}: {v}</title></rect>
              {v > 0 && <text x={x + w / 2} y={y - 4} fontSize="10" fontWeight={600} fill="#059669" textAnchor="middle">{v}</text>}
              {i % showEvery === 0 && <text x={x + w / 2} y={H - 7} fontSize="10" fill="#9ca3af" textAnchor="middle">{lbl}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
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
  const [metric, setMetric] = useState<keyof DayPoint>('novosContatos')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { from, to } = rangeFor(preset, customFrom, customTo)
    const r = await fetch(`/api/analytics?from=${from.toISOString()}&to=${to.toISOString()}`)
    setData(await r.json())
    setLoading(false)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 20000) // atualiza sozinho, sem piscar
    return () => clearInterval(t)
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
          {/* 🔴 LEADS AGUARDANDO RESPOSTA — central anti-perda de lead */}
          <section className="mb-6 overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/60 px-5 py-4">
              <div>
                <h2 className="font-bold text-gray-800">🔴 Leads aguardando resposta <span className="text-xs font-normal text-gray-400">(agora)</span></h2>
                <p className="text-xs text-gray-500">o paciente falou por último — responda pra não perder o agendamento</p>
              </div>
              <span className={`rounded-full px-3.5 py-1.5 text-lg font-extrabold ${data.waiting.length ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{data.waiting.length}</span>
            </div>
            {data.waiting.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm font-medium text-emerald-600">🎉 Tudo respondido! Nenhum lead esperando.</div>
            ) : (
              <div className="max-h-[22rem] overflow-y-auto">
                {data.waiting.map((w) => {
                  const urgent = w.waitingMin >= 30
                  return (
                    <div key={w.contact_id} className="flex items-center gap-3 border-b border-gray-50 px-5 py-3 last:border-0 hover:bg-gray-50/60">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${urgent ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-800">{w.name?.trim() || w.phone || 'Sem nome'}</div>
                        <div className="truncate text-xs text-gray-400">{w.last_text || '—'}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${urgent ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>⏱ {fmtTempo(w.waitingMin)}</span>
                      <a href={`/inbox?c=${w.contact_id}`} className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">Responder →</a>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* cards principais */}
          <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card label="Leads no período" value={data.leadsPeriodo} icon="🌟" tone="emerald" hint="novos contatos" />
            <Card label="Aguardando agora" value={data.emAberto} icon="⏳" tone={data.emAberto ? 'amber' : 'green'} hint="sem resposta" />
            <Card label="Concluídas no período" value={data.fechadas} icon="✅" tone="green" />
            <Card label="Tempo médio de resposta" value={fmtTempo(data.tempoMedioRespMin)} icon="⏱️" tone="sky" />
            <Card label="Taxa de resposta" value={data.taxaResposta == null ? '—' : `${data.taxaResposta}%`} icon="🎯" tone={data.taxaResposta != null && data.taxaResposta < 80 ? 'amber' : 'green'} hint="leads que responderam" />
            <Card label="Em atendimento (humano)" value={data.emAtendimento} icon="🙋" tone="indigo" />
            <Card label="Recebidas no período" value={data.recebidas} icon="📥" tone="slate" />
            <Card label="Enviadas no período" value={data.enviadas} icon="📤" tone="violet" />
          </section>

          {/* ESTATÍSTICAS POR PERÍODO (gráfico) */}
          <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-gray-800">📈 Estatísticas por período</h2>
              <select value={metric} onChange={(e) => setMetric(e.target.value as keyof DayPoint)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-emerald-400">
                {METRICS.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}
              </select>
            </div>
            <div className="pt-1">
              <BarChart series={data.series} metric={metric} />
            </div>
          </section>

          {/* ESTATÍSTICAS DE CHAT POR MEMBROS */}
          <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-800">👥 Estatísticas de chat por membros</h2>
              <p className="text-xs text-gray-400">no período selecionado</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                    <th className="px-4 py-3">Membro da equipe</th>
                    <th className="px-4 py-3 text-center">Respondido</th>
                    <th className="px-4 py-3 text-center">Fechado</th>
                    <th className="px-4 py-3 text-center">Tempo mediano 1ª resp.</th>
                    <th className="px-4 py-3 text-center">Tempo médio 1ª resp.</th>
                    <th className="px-4 py-3 text-center">Tempo mediano fech.</th>
                    <th className="px-4 py-3 text-center">Tempo médio fech.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-semibold text-white">{m.name.slice(0, 2).toUpperCase()}</span>
                          <span className="font-medium text-gray-800">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">{m.respondido}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">{m.fechado}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{fmtDur(m.primeiraMedianaSeg)}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{fmtDur(m.primeiraMediaSeg)}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{fmtDur(m.fechamentoMedianaSeg)}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{fmtDur(m.fechamentoMediaSeg)}</td>
                    </tr>
                  ))}
                  {data.members.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Sem dados de membros no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* ranking de atendentes com performance */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-gray-800">🏆 Performance dos atendentes</h2>
                <p className="text-xs text-gray-400">no período selecionado</p>
              </div>
              <div className="hidden gap-6 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:flex">
                <span className="w-20 text-right">Mensagens</span>
                <span className="w-24 text-right">Tempo resp.</span>
              </div>
            </div>
            {data.ranking.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Sem dados de atendente ainda. (Aparece quando os atendentes responderem pelo inbox.)</div>
            ) : (
              <div>
                {data.ranking.map((r, i) => {
                  const max = data.ranking[0].respostas || 1
                  const medal = ['🥇', '🥈', '🥉'][i]
                  return (
                    <div key={r.atendente} className="flex items-center gap-3 border-b border-gray-50 px-5 py-3.5 last:border-0 hover:bg-gray-50/60">
                      <span className="w-7 text-center text-base">{medal ?? <span className="text-sm font-semibold text-gray-400">{i + 1}º</span>}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{r.atendente}</span>
                      <div className="hidden h-2.5 w-32 overflow-hidden rounded-full bg-gray-100 sm:block">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${(r.respostas / max) * 100}%` }} />
                      </div>
                      <span className="w-20 text-right text-sm font-bold text-gray-700">{r.respostas}</span>
                      <span className={`w-24 text-right text-xs font-semibold ${r.tempoRespMin != null && r.tempoRespMin <= 10 ? 'text-emerald-600' : r.tempoRespMin != null && r.tempoRespMin > 60 ? 'text-red-500' : 'text-gray-500'}`}>{fmtTempo(r.tempoRespMin)}</span>
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
