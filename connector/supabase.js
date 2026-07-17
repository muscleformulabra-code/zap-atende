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

// Empresa padrão (a clínica) quando o conector não passa company_id — mantém
// tudo funcionando na Empresa #1 na transição pro multi-WhatsApp.
const SEED_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

// Salva/atualiza o contato. MULTI-EMPRESA: a chave passa a ser (company_id, jid)
// — o mesmo número pode ser contato de empresas diferentes sem conflito. Só
// manda o nome quando temos um, pra não sobrescrever com vazio.
async function upsertContact({ jid, phone, name, companyId }) {
  const cid = companyId || SEED_COMPANY_ID
  const row = { jid, company_id: cid }
  if (phone) row.phone = phone // não sobrescreve com vazio (ex.: LID sem número real)
  if (name) row.name = name

  const res = await fetch(`${REST}/contacts?on_conflict=company_id,jid`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`upsertContact ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return Array.isArray(data) ? data[0] : data
}

// Guarda a mensagem. 409 = duplicada (mesmo id do WhatsApp) -> ignora.
async function insertMessage({ contactId, jid, fromMe, text, waMessageId, sentAt, sentBy, companyId, mediaUrl, mediaType }) {
  const row = {
    contact_id: contactId,
    jid,
    from_me: fromMe,
    text,
    wa_message_id: waMessageId,
    sent_at: sentAt,
    sent_by: sentBy ?? null,
    company_id: companyId || SEED_COMPANY_ID,
  }
  if (mediaUrl) row.media_url = mediaUrl
  if (mediaType) row.media_type = mediaType
  let res = await fetch(`${REST}/messages`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  // Se as colunas de mídia ainda não existem no banco, tenta sem elas.
  if (!res.ok && res.status !== 409 && (mediaUrl || mediaType)) {
    delete row.media_url; delete row.media_type
    res = await fetch(`${REST}/messages`, { method: 'POST', headers: { ...baseHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(row) })
  }
  if (!res.ok && res.status !== 409) {
    throw new Error(`insertMessage ${res.status}: ${await res.text()}`)
  }
}

// Sobe um buffer de mídia pro Storage (bucket flyers, público) e devolve a URL.
async function uploadMedia(buffer, filename, mimetype) {
  const safe = (filename || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_')
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `wa/${Date.now()}_${rand}_${safe}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/flyers/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': mimetype || 'application/octet-stream', 'x-upsert': 'true' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`uploadMedia ${res.status}: ${await res.text()}`)
  return `${SUPABASE_URL}/storage/v1/object/public/flyers/${path}`
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
async function setSessionDone(contactId, updatedAt, companyId) {
  try {
    await fetch(`${REST}/flow_sessions?on_conflict=contact_id`, {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ contact_id: contactId, status: 'done', company_id: companyId || SEED_COMPANY_ID, updated_at: updatedAt || new Date().toISOString() }),
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

// Lista contatos @lid (número real escondido pelo WhatsApp) de uma empresa,
// pra reprocessar e traduzir pro número verdadeiro.
async function listLidContacts(companyId) {
  const cid = companyId || SEED_COMPANY_ID
  const res = await fetch(`${REST}/contacts?company_id=eq.${cid}&jid=like.*@lid&select=id,jid,phone,name&limit=100000`, { headers: baseHeaders })
  return res.ok ? res.json() : []
}

// Atualiza campos de um contato (ex.: telefone real resolvido do LID).
async function patchContact(id, fields) {
  await fetch(`${REST}/contacts?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  })
}

module.exports = { upsertContact, insertMessage, updateAvatar, setSessionDone, applyTagOps, uploadMedia, keyInfo, listLidContacts, patchContact }
