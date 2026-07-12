// Permissões por atendente (guardadas no user_metadata do Supabase Auth).
// Módulo SEM dependências de servidor — usado no cliente (nav/equipe),
// no middleware (edge) e nas rotas de API.

export type PermKey = 'painel' | 'inbox' | 'contatos' | 'fluxos' | 'respostas' | 'config' | 'equipe'
export type Perms = Record<PermKey, boolean>

export const PERM_LIST: { key: PermKey; label: string; href: string }[] = [
  { key: 'painel', label: 'Painel', href: '/' },
  { key: 'inbox', label: 'Inbox', href: '/inbox' },
  { key: 'contatos', label: 'Contatos', href: '/contatos' },
  { key: 'fluxos', label: 'Fluxos', href: '/fluxos' },
  { key: 'respostas', label: 'Respostas', href: '/respostas' },
  { key: 'config', label: 'Config', href: '/config' },
  { key: 'equipe', label: 'Equipe', href: '/equipe' },
]

export const ALL_TRUE: Perms = { painel: true, inbox: true, contatos: true, fluxos: true, respostas: true, config: true, equipe: true }
export const DEFAULT_MEMBER: Perms = { painel: true, inbox: true, contatos: true, fluxos: false, respostas: true, config: false, equipe: false }

export function normalizePerms(p?: Partial<Perms> | null): Perms {
  return {
    painel: p?.painel ?? false,
    inbox: p?.inbox ?? false,
    contatos: p?.contatos ?? false,
    fluxos: p?.fluxos ?? false,
    respostas: p?.respostas ?? false,
    config: p?.config ?? false,
    equipe: p?.equipe ?? false,
  }
}

// Qual permissão uma rota exige (null = rota livre p/ qualquer logado).
export function permForPath(pathname: string): PermKey | null {
  if (pathname === '/') return 'painel'
  if (pathname.startsWith('/inbox')) return 'inbox'
  if (pathname.startsWith('/contatos')) return 'contatos'
  if (pathname.startsWith('/fluxos') || pathname.startsWith('/construtor') || pathname.startsWith('/simulador')) return 'fluxos'
  if (pathname.startsWith('/respostas')) return 'respostas'
  if (pathname.startsWith('/config')) return 'config'
  if (pathname.startsWith('/equipe')) return 'equipe'
  return null
}

// Lê as permissões de dentro de um JWT do Supabase (sem verificar assinatura —
// é o nosso próprio cookie httpOnly). Retorna null se o usuário não tem perms
// definidas = DONO/admin (acesso total, legado).
// Decodifica o payload (claims) do JWT sem verificar assinatura.
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    const json =
      typeof atob !== 'undefined'
        ? atob(part.replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(part, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function permsFromJwt(token: string): Perms | null {
  const payload = decodeJwt(token) as { user_metadata?: { perms?: Partial<Perms> } } | null
  const perms = payload?.user_metadata?.perms
  return perms ? normalizePerms(perms) : null
}

// Segundos até o token expirar (negativo = já expirou; null = sem exp legível).
export function secondsUntilExpiry(token: string): number | null {
  const payload = decodeJwt(token) as { exp?: number } | null
  if (!payload?.exp) return null
  return payload.exp - Math.floor(Date.now() / 1000)
}
