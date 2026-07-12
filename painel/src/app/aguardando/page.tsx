'use client'

import { useEffect, useState } from 'react'

export default function Aguardando() {
  const [email, setEmail] = useState('')
  const [checking, setChecking] = useState(false)

  // Checa se já fomos convidados (o /api/me auto-cura o cookie da empresa).
  async function check(auto = false) {
    if (!auto) setChecking(true)
    try {
      const r = await fetch('/api/me', { cache: 'no-store' })
      const d = await r.json()
      setEmail(d.email || '')
      if (d.hasCompany) {
        window.location.href = '/'
        return true
      }
    } catch {
      /* ignora */
    } finally {
      if (!auto) setChecking(false)
    }
    return false
  }

  useEffect(() => {
    check(true)
    const t = setInterval(() => check(true), 8000) // re-checa a cada 8s
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />

      <div className="za-pop relative w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-2xl shadow-emerald-100 backdrop-blur">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-3xl text-white shadow-lg shadow-amber-200">⏳</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Conta criada!</h1>
        <p className="mt-2 text-sm text-gray-600">
          Agora um administrador precisa te <strong>convidar</strong> para a empresa usando o seu e-mail:
        </p>
        {email && <p className="mt-2 inline-block rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">{email}</p>}
        <p className="mt-4 text-sm text-gray-500">
          Passe esse e-mail para o responsável. Assim que ele te convidar, esta tela libera o acesso sozinha.
        </p>

        <button
          onClick={() => check(false)}
          disabled={checking}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
        >
          {checking ? 'verificando…' : 'Já fui convidado — verificar'}
        </button>

        <button
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
        >
          Sair
        </button>
      </div>
    </main>
  )
}
