import { NextResponse } from 'next/server'
import { getSettings, saveSettings, type Settings } from '@/lib/settings-db'

export async function GET(req: Request) {
  // O conector passa ?company=<id> pra pegar as configurações da empresa certa.
  const company = new URL(req.url).searchParams.get('company') || undefined
  return NextResponse.json(await getSettings(company))
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Settings>
  await saveSettings(body)
  return NextResponse.json({ ok: true })
}
