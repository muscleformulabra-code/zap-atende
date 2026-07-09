'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ALL_TRUE, PERM_LIST, permForPath, type PermKey, type Perms } from '@/lib/perms'

const ICONS: Record<PermKey, string> = {
  painel: '📊',
  inbox: '💬',
  contatos: '📇',
  fluxos: '🔀',
  respostas: '⚡',
  config: '⚙️',
  equipe: '👥',
}

export default function Sidebar() {
  const p = usePathname()
  const [perms, setPerms] = useState<Perms>(ALL_TRUE)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { setPerms(d.perms ?? ALL_TRUE); setEmail(d.email ?? null) })
      .catch(() => {})
  }, [])

  if (p === '/login') return null

  const active = permForPath(p)
  const items = PERM_LIST.filter((i) => perms[i.key])

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-lg text-white shadow-sm">💬</span>
        <span className="text-lg font-bold text-gray-900">Zap Atende</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((i) => {
          const isActive = active === i.key
          return (
            <a
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{ICONS[i.key]}</span>
              {i.label}
            </a>
          )
        })}
      </nav>

      <div className="border-t border-gray-100 px-4 py-3">
        {email && (
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-semibold text-white">
              {email.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-xs text-gray-500">{email}</span>
          </div>
        )}
        <form action="/api/logout" method="post">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-red-50 hover:text-red-600">↩ Sair</button>
        </form>
      </div>
    </aside>
  )
}
