'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ALL_TRUE, PERM_LIST, type Perms } from '@/lib/perms'

// Barra de navegação. Escondida no login e nas telas "cheias" (inbox/construtor),
// que têm cabeçalho próprio.
const HIDDEN = ['/login', '/construtor', '/inbox']

export default function Nav() {
  const p = usePathname()
  const [perms, setPerms] = useState<Perms>(ALL_TRUE)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { setPerms(d.perms ?? ALL_TRUE); setEmail(d.email ?? null) })
      .catch(() => {})
  }, [])

  if (HIDDEN.includes(p)) return null

  const link = (href: string, label: string) => (
    <a
      key={href}
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm ${p === href ? 'bg-emerald-100 font-medium text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {label}
    </a>
  )

  return (
    <nav className="flex items-center gap-1 border-b border-gray-200 bg-white px-4 py-2">
      <span className="mr-3 font-bold text-gray-900">Zap Atende</span>
      {PERM_LIST.filter((item) => perms[item.key]).map((item) => link(item.href, item.label))}
      <div className="ml-auto flex items-center gap-2">
        {email && <span className="hidden text-xs text-gray-400 sm:inline">{email}</span>}
        <form action="/api/logout" method="post">
          <button className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600">sair</button>
        </form>
      </div>
    </nav>
  )
}
