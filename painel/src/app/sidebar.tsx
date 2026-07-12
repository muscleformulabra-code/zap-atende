'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode, type SVGProps } from 'react'
import { ALL_TRUE, PERM_LIST, permForPath, type PermKey, type Perms } from '@/lib/perms'

// Ícones de linha. stroke = currentColor herda a cor do link.
function Icon({ d, ...p }: { d: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[21px] w-[21px]" {...p}>
      <path d={d} />
    </svg>
  )
}

const ICONS: Record<PermKey, ReactNode> = {
  painel: <Icon d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
  inbox: <Icon d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  contatos: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  fluxos: <Icon d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15 6a9 9 0 0 1-9 9" />,
  respostas: <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  config: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  equipe: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
}

// Agrupa os itens em seções (só aparece a seção que tiver item permitido).
const GROUPS: { title: string | null; keys: PermKey[] }[] = [
  { title: null, keys: ['painel'] },
  { title: 'Atendimento', keys: ['inbox', 'contatos', 'fluxos'] }, // Respostas agora só em Configurações
  { title: 'Sistema', keys: ['config'] }, // Equipe agora fica dentro de Configurações
]

const labelFor = (k: PermKey) => PERM_LIST.find((i) => i.key === k)?.label ?? k
const hrefFor = (k: PermKey) => PERM_LIST.find((i) => i.key === k)?.href ?? '/'

export default function Sidebar() {
  const p = usePathname()
  const [perms, setPerms] = useState<Perms>(ALL_TRUE)
  const [online, setOnline] = useState<boolean | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string; role: string }[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [switcher, setSwitcher] = useState(false)
  const [busca, setBusca] = useState('')

  // Telas de autenticação (sem sidebar).
  const AUTH = p === '/login' || p === '/cadastro' || p === '/aguardando'

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { setPerms(d.perms ?? ALL_TRUE); setCompanyId(d.company_id ?? null) })
      .catch(() => {})
    fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => setCompanies(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  async function trocarEmpresa(id: string) {
    if (id === companyId) { setSwitcher(false); return }
    await fetch('/api/companies/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: id }) })
    window.location.href = '/' // recarrega tudo já na empresa nova
  }

  async function novaEmpresa() {
    const nome = prompt('Nome da nova empresa:')
    if (!nome || !nome.trim()) return
    const r = await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nome }) })
    if (r.ok) window.location.href = '/'
  }

  const empresaAtual = companies.find((c) => c.id === companyId)
  const empresasFiltradas = companies.filter((c) => c.name.toLowerCase().includes(busca.toLowerCase()))

  useEffect(() => {
    if (AUTH) return
    let alive = true
    const ping = () => fetch('/api/status').then((r) => r.json()).then((d) => alive && setOnline(!!d.whatsapp)).catch(() => alive && setOnline(false))
    ping()
    const t = setInterval(ping, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [p, AUTH])

  if (AUTH) return null

  const active = permForPath(p)

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200/80 bg-white">
      {/* LOGO */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-xl text-white shadow-lg shadow-emerald-200/70">💬</span>
        <div className="leading-tight">
          <span className="block text-[17px] font-extrabold tracking-tight text-gray-900">Ricco Chat</span>
          <span className="block text-[11px] font-medium text-gray-400">Atendimento inteligente</span>
        </div>
      </div>

      {/* NAV agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {GROUPS.map((g, gi) => {
          const keys = g.keys.filter((k) => perms[k])
          if (keys.length === 0) return null
          return (
            <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
              {g.title && <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300">{g.title}</div>}
              <div className="space-y-1">
                {keys.map((k) => {
                  const isActive = active === k
                  return (
                    <a
                      key={k}
                      href={hrefFor(k)}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-emerald-500'}>{ICONS[k]}</span>
                      {labelFor(k)}
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Assistente de Leads (IA) — sempre visível */}
        <div className="mt-5">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300">Inteligência</div>
          <a
            href="/assistente"
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-all ${
              p === '/assistente'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className={p === '/assistente' ? 'text-white' : 'text-gray-400 group-hover:text-emerald-500'}>
              <Icon d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.5 1 2.5h6c0-1 .5-2 1-2.5A6 6 0 0 0 12 3z" />
            </span>
            Assistente de Leads
          </a>
        </div>
      </nav>

      {/* RODAPÉ: seletor de empresa + conexão + usuário + sair */}
      <div className="space-y-2 border-t border-gray-100 px-3 py-3">
        {/* SELETOR DE EMPRESA (igual BotConversa) */}
        {companyId && (
          <div className="relative">
            {switcher && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSwitcher(false)} />
                <div className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  <div className="border-b border-gray-100 p-2">
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa…" className="w-full rounded-lg bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-100" autoFocus />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {empresasFiltradas.map((c) => {
                      const atual = c.id === companyId
                      return (
                        <button key={c.id} onClick={() => trocarEmpresa(c.id)} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-gray-50 ${atual ? 'bg-emerald-50/60' : ''}`}>
                          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-[11px] font-bold text-white">
                            {c.name.slice(0, 2).toUpperCase()}
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-sm font-semibold text-gray-800">{c.name}</span>
                            <span className="block truncate text-[11px] capitalize text-gray-400">{c.role === 'owner' ? 'dono' : c.role}</span>
                          </span>
                          {atual && <span className="text-emerald-500">✓</span>}
                        </button>
                      )
                    })}
                    {empresasFiltradas.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-400">nenhuma empresa</div>}
                  </div>
                  <button onClick={novaEmpresa} className="flex w-full items-center justify-center gap-2 border-t border-gray-100 bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    + Adicionar nova empresa
                  </button>
                </div>
              </>
            )}
            <button onClick={() => { setSwitcher((s) => !s); setBusca('') }} className="flex w-full items-center gap-2.5 rounded-xl border border-gray-200 px-2.5 py-2 text-left transition hover:bg-gray-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-[11px] font-bold text-white">
                {(empresaAtual?.name || 'E1').slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-xs font-bold text-gray-800">{empresaAtual?.name || 'Minha empresa'}</span>
                <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-400">trocar empresa</span>
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-gray-400"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
          <span className="relative flex h-2.5 w-2.5">
            {online && <span className="za-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online == null ? 'bg-gray-300' : online ? 'bg-emerald-500' : 'bg-red-400'}`} />
          </span>
          <span className="text-xs font-medium text-gray-500">
            {online == null ? 'Verificando…' : online ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
          </span>
        </div>

      </div>
    </aside>
  )
}
