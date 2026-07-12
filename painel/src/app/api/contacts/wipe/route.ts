import { NextResponse } from 'next/server'
import { deleteAllContacts } from '@/lib/db'

// Exclui TODOS os contatos da empresa. Destrutivo → exige confirm:"EXCLUIR".
export async function POST(req: Request) {
  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'EXCLUIR') return NextResponse.json({ error: 'confirmação inválida' }, { status: 400 })
  const n = await deleteAllContacts()
  return NextResponse.json({ ok: true, deleted: n })
}
