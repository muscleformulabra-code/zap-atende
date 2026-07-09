'use client'

import { usePathname } from 'next/navigation'

// Barra de navegação. Escondida no login e nas telas "cheias" (inbox/construtor),
// que têm cabeçalho próprio.
const HIDDEN = ['/login', '/construtor', '/inbox']

export default function Nav() {
  const p = usePathname()
  if (HIDDEN.includes(p)) return null

  const link = (href: string, label: string) => (
    <a
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm ${p === href ? 'bg-emerald-100 font-medium text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {label}
    </a>
  )

  return (
    <nav className="flex items-center gap-1 border-b border-gray-200 bg-white px-4 py-2">
      <span className="mr-3 font-bold text-gray-900">Zap Atende</span>
      {link('/', 'Painel')}
      {link('/inbox', 'Inbox')}
      {link('/fluxos', 'Fluxos')}
      {link('/respostas', 'Respostas')}
      {link('/config', 'Config')}
      {link('/equipe', 'Equipe')}
      <form action="/api/logout" method="post" className="ml-auto">
        <button className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600">sair</button>
      </form>
    </nav>
  )
}
