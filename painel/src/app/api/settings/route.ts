import { NextResponse } from 'next/server'
import { getSettings, saveSettings, type Settings } from '@/lib/settings-db'

export async function GET() {
  return NextResponse.json(await getSettings())
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Settings>
  await saveSettings(body)
  return NextResponse.json({ ok: true })
}
