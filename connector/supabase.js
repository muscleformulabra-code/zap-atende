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
  const row = { jid }
  if (phone) row.phone = phone // não sobrescreve com vazio (ex.: LID sem número real)
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

// Atualiza a foto de perfil do contato (guarda a URL + quando foi buscada).
// Tolerante: se a coluna ainda não existir, só ignora.
async function updateAvatar(contactId, avatarUrl) {
  try {
    await fetch(`${REST}/contacts?id=eq.${contactId}`, {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ avatar_url: avatarUrl || null, avatar_updated_at: new Date().toISOString() }),
    })
  } catch {
    /* coluna avatar_url ainda não migrada — ignora */
  }
}

// Marca a sessão do contato como 'done' (usado no histórico → vai pra Concluídas).
// updatedAt = hora da última mensagem, pra o re-engajamento (12h) funcionar certo.
async function setSessionDone(contactId, updatedAt) {
  try {
    await fetch(`${REST}/flow_sessions?on_conflict=contact_id`, {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ contact_id: contactId, status: 'done', updated_at: updatedAt || new Date().toISOString() }),
    })
  } catch {
    /* ignora */
  }
}

// Aplica operações de etiqueta (add/remove) no contato (bloco Etiqueta do fluxo).
async function applyTagOps(contactId, tagOps) {
  if (!contactId || !Array.isArray(tagOps) || tagOps.length === 0) return
  try {
    const r = await fetch(`${REST}/contacts?id=eq.${contactId}&select=tags`, { headers: baseHeaders })
    const rows = await r.json()
    let tags = Array.isArray(rows[0]?.tags) ? rows[0].tags.slice() : []
    for (const op of tagOps) {
      const t = (op.tag || '').trim()
      if (!t) continue
      if (op.op === 'remove') tags = tags.filter((x) => x !== t)
      else if (!tags.includes(t)) tags.push(t)
    }
    await fetch(`${REST}/contacts?id=eq.${contactId}`, {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ tags }),
    })
  } catch {
    /* coluna tags pode não existir ainda — ignora */
  }
}

// Impressão digital da chave (sem expor o segredo) pra diagnóstico.
const keyInfo = { len: KEY.length, head: KEY.slice(0, 6), tail: KEY.slice(-4) }

module.exports = { upsertContact, insertMessage, updateAvatar, setSessionDone, applyTagOps, keyInfo }
