import { NextResponse } from 'next/server'
import { getSettings, saveSettings, type Settings } from '@/lib/settings-db'
import { currentCompanyId, renameCompany } from '@/lib/company'

export async function GET(req: Request) {
  // O conector passa ?company=<id> pra pegar as configurações da empresa certa.
  const company = new URL(req.url).searchParams.get('company') || undefined
  return NextResponse.json(await getSettings(company))
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Settings>
  await saveSettings(body)
  // O nome da empresa também é o nome REAL exibido no seletor/sidebar
  // (tabela companies) — mantém os dois em sincronia.
  if (typeof body.company_name === 'string' && body.company_name.trim()) {
    const cid = await currentCompanyId()
    if (cid) await renameCompany(cid, body.company_name)
  }
  return NextResponse.json({ ok: true })
}
