// Camada de acesso ao banco (Supabase) via API REST (PostgREST).
// Usa fetch nativo do Node 20 — sem dependências pesadas.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim()
// Sanitiza a chave: um JWT só tem [A-Za-z0-9._-]. Remove espaços, quebras de
// linha e qualquer caractere não-ASCII (ex.: "•" colado por engano no painel do
// Railway) que estouraria a validação de header (ByteString) do fetch.
const KEY_RAW = process.env.SUPABASE_SERVICE_KEY || ''
const KEY = KEY_RAW.replace(/[^A-Za-z0-9._-]/g, '')

if (!SUPABASE_URL || !KEY) {
  console.error('\n❌ Faltam credenciais. Preencha SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo connector/.env\n')
  process.exit(1)
}
if (KEY_RAW !== KEY) {
  console.warn(`⚠️  SUPABASE_SERVICE_KEY tinha caracteres inválidos e foi limpa (${KEY_RAW.length} -> ${KEY.length} chars).`)
}

const REST = `${SUPABASE_URL}/rest/v1`
const baseHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

// Salva/atualiza o contato (chave: jid). Só manda o nome quando temos um,
// pra não sobrescrever com vazio.
async function upsertContact({ jid, phone, name }) {
  const row = { jid, phone }
  if (name) row.name = name

  const res = await fetch(`${REST}/contacts?on_conflict=jid`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`upsertContact ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return Array.isArray(data) ? data[0] : data
}

// Guarda a mensagem. 409 = duplicada (mesmo id do WhatsApp) -> ignora.
async function insertMessage({ contactId, jid, fromMe, text, waMessageId, sentAt, sentBy }) {
  const res = await fetch(`${REST}/messages`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      jid,
      from_me: fromMe,
      text,
      wa_message_id: waMessageId,
      sent_at: sentAt,
      sent_by: sentBy ?? null,
    }),
  })
  if (!res.ok && res.status !== 409) {
    throw new Error(`insertMessage ${res.status}: ${await res.text()}`)
  }
}

module.exports = { upsertContact, insertMessage }
