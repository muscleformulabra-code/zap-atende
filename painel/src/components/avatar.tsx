'use client'

import { useState } from 'react'

function initials(name?: string | null, phone?: string | null) {
  if (name?.trim()) return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return (phone ?? '?').slice(-2)
}

// Avatar do lead: mostra a foto de perfil do WhatsApp (quando existe e a
// privacidade permite). Se não tiver, ou se a URL expirar/quebrar, cai para as
// iniciais num círculo em gradiente.
export default function Avatar({
  name,
  phone,
  src,
  className = 'h-10 w-10 text-sm',
}: {
  name?: string | null
  phone?: string | null
  src?: string | null
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const showImg = src && !broken
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 font-semibold text-white ${className}`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? phone ?? 'contato'} onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        initials(name, phone)
      )}
    </div>
  )
}
