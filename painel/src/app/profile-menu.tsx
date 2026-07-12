'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Menu de perfil no canto superior direito (igual BotConversa): avatar redondo
// que abre um dropdown com "Ir para o perfil" e "Sair".
export default function ProfileMenu() {
  const p = usePathname()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)

  const AUTH = p === '/login' || p === '/cadastro' || p === '/aguardando'

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { setEmail(d.email ?? null); setName(d.name ?? null) })
      .catch(() => {})
  }, [])

  if (AUTH || !email) return null

  const initials = (name || email).slice(0, 2).toUpperCase()

  return (
    <div className="fixed right-5 top-4 z-50">
      {open && <div className="fixed inset-0 z-0" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((s) => !s)}
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[13px] font-bold text-white shadow-lg shadow-emerald-200/70 ring-2 ring-white transition hover:scale-105"
        title="Perfil"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <a href="/perfil" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[13px] font-bold text-white">{initials}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-gray-800">{name || 'Meu perfil'}</span>
              <span className="block truncate text-xs text-emerald-600">Ir para o perfil →</span>
            </span>
          </a>
          <div className="truncate border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">{email}</div>
          <form action="/api/logout" method="post" className="border-t border-gray-100">
            <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
