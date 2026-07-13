'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Faixa superior (estilo BotConversa): título da seção à esquerda; à direita o
// toggle de som das notificações, ajuda e o menu de perfil (avatar + dropdown).
const TITLES: Record<string, string> = {
  '/': 'Painel de controle',
  '/inbox': 'Inbox',
  '/pendencias': 'Pendências',
  '/contatos': 'Contatos',
  '/fluxos': 'Fluxos',
  '/respostas': 'Respostas rápidas',
  '/config': 'Configurações',
  '/equipe': 'Equipe',
  '/perfil': 'Meu perfil',
  '/construtor': 'Construtor de fluxo',
  '/simulador': 'Simulador',
}

// Beep curto (Web Audio) — sem precisar de arquivo de áudio.
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.start()
    o.stop(ctx.currentTime + 0.26)
    o.onended = () => ctx.close()
  } catch {
    /* navegador sem áudio — ignora */
  }
}

export default function TopBar() {
  const p = usePathname()
  const [email, setEmail] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [sound, setSound] = useState(false)

  const AUTH = p === '/login' || p === '/cadastro' || p === '/aguardando'

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { setEmail(d.email ?? null); setName(d.name ?? null) })
      .catch(() => {})
    try { setSound(localStorage.getItem('za_sound') === '1') } catch {}
  }, [])

  if (AUTH) return null

  const title = TITLES[p] ?? 'Ricco Chat'
  const initials = (name || email || '?').slice(0, 2).toUpperCase()

  function toggleSound() {
    const v = !sound
    setSound(v)
    try { localStorage.setItem('za_sound', v ? '1' : '0') } catch {}
    if (v) beep() // toca uma vez ao ligar, pra confirmar
  }

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="truncate text-[17px] font-bold tracking-tight text-gray-800">{title}</h1>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Som das notificações */}
        <button onClick={toggleSound} className="flex items-center gap-2 rounded-full py-1 pl-2 pr-1 transition hover:bg-gray-50" title="Som das notificações do chat ao vivo">
          <span className="hidden text-sm font-medium text-gray-500 md:inline">Som das notificações</span>
          <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sound ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sound ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
        </button>

        {/* Ajuda */}
        <a href="mailto:suporte@riccochat.com" title="Ajuda" className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-sm font-bold text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">?</a>

        {/* Perfil */}
        <div className="relative">
          {open && <div className="fixed inset-0 z-0" onClick={() => setOpen(false)} />}
          <button onClick={() => setOpen((s) => !s)} className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[12px] font-bold text-white shadow-md shadow-emerald-200/70 ring-2 ring-white transition hover:scale-105" title="Perfil">
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
      </div>
    </header>
  )
}
