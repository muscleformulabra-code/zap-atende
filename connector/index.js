// ─────────────────────────────────────────────────────────────
//  RICCO CHAT — Conector WhatsApp (Fase 3: MULTI-EMPRESA)
//  Roda VÁRIOS WhatsApp ao mesmo tempo — um por empresa. Cada sessão tem sua
//  própria pasta de credenciais (./auth/<companyId>) e carimba company_id em
//  tudo que salva no banco. A Empresa #1 (a clínica) migra da sessão antiga
//  (flat em ./auth) sem precisar re-escanear.
// ─────────────────────────────────────────────────────────────
require('dotenv').config()

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const QRImage = require('qrcode')
const path = require('path')
const http = require('http')
const fs = require('fs')
const pino = require('pino')

const { upsertContact, insertMessage, updateAvatar, setSessionDone, applyTagOps, uploadMedia, keyInfo } = require('./supabase')
const BAILEYS_VERSION = (() => { try { return require('@whiskeysockets/baileys/package.json').version } catch { return '?' } })()
const { handleIncoming, getSettings } = require('./bot')

const SEED_COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const AUTH_ROOT = path.join(__dirname, 'auth')

// Ligações (voz/vídeo): o atendimento é só por mensagem. O robô recusa a
// chamada e manda um aviso. Texto padrão (a empresa pode sobrescrever via
// settings.call_reject_message).
const DEFAULT_CALL_MSG =
  'Olá! 👋 Vi que você tentou ligar. Aqui neste número a gente atende *somente por mensagem* — não conseguimos atender chamadas. 😊\nPode me mandar sua dúvida por escrito que já te respondo por aqui!'
const CALL_REPLY_COOLDOWN_MS = 10 * 60 * 1000 // no máx. 1 aviso a cada 10 min por contato

// Uma sessão por empresa. companyId -> { sock, waConnected, resetting, reconnecting, diag, qr }
const sessions = new Map()

function newDiag() {
  return { upsertEvents: 0, notifyEvents: 0, processed: 0, saved: 0, botReplies: 0, botPath: null, lastReplyCount: null, lastBotError: null, lastError: null, lastFrom: null, lastText: null, lastType: null }
}

function getSession(companyId) {
  let s = sessions.get(companyId)
  if (!s) {
    s = { companyId, sock: null, waConnected: false, resetting: false, reconnecting: false, diag: newDiag(), qr: null }
    sessions.set(companyId, s)
  }
  return s
}

const authDirFor = (companyId) => path.join(AUTH_ROOT, companyId)
const qrPathFor = (companyId) => path.join(__dirname, `qr_${companyId}.png`)

// Migra a sessão ANTIGA (flat em ./auth/creds.json) para ./auth/<SEED>/ — assim
// a clínica não precisa re-escanear o QR ao virar multi-empresa.
function migrateFlatAuth() {
  try {
    if (!fs.existsSync(path.join(AUTH_ROOT, 'creds.json'))) return
    const seedDir = authDirFor(SEED_COMPANY_ID)
    fs.mkdirSync(seedDir, { recursive: true })
    for (const f of fs.readdirSync(AUTH_ROOT)) {
      const src = path.join(AUTH_ROOT, f)
      if (fs.statSync(src).isDirectory()) continue // não mexe em pastas de empresas
      fs.renameSync(src, path.join(seedDir, f))
    }
    console.log('📦 Sessão antiga migrada para', seedDir)
  } catch (e) {
    console.error('migrateFlatAuth:', e.message)
  }
}

// Apaga as credenciais de UMA empresa (logout / reset). Não derruba as outras.
function wipeAuth(companyId) {
  try {
    fs.rmSync(authDirFor(companyId), { recursive: true, force: true })
  } catch (e) {
    getSession(companyId).diag.lastError = 'wipeAuth: ' + (e.message || e)
  }
}

// Envia uma resposta do bot (texto OU mídia) com "digitando…" e atraso
// humanizado (anti-ban). Também GRAVA no banco (com company_id).
async function botSend(sock, target, reply, settings, contactId, companyId) {
  const r = typeof reply === 'string' ? { text: reply } : reply
  const min = settings?.min_delay_ms ?? 1200
  const max = Math.max(settings?.max_delay_ms ?? 3500, min)
  const wait = Math.floor(min + Math.random() * (max - min))
  try { await sock.sendPresenceUpdate('composing', target) } catch {}
  await new Promise((res) => setTimeout(res, wait))
  let sent
  if (r.image) {
    sent = await sock.sendMessage(target, { image: { url: r.image }, caption: r.caption || '' })
  } else if (r.video) {
    sent = await sock.sendMessage(target, { video: { url: r.video }, caption: r.caption || '' })
  } else if (r.file) {
    const name = r.fileName || 'arquivo'
    const isPdf = /\.pdf(\?|$)/i.test(name) || /\.pdf(\?|$)/i.test(r.file)
    sent = await sock.sendMessage(target, { document: { url: r.file }, fileName: name, mimetype: isPdf ? 'application/pdf' : 'application/octet-stream', caption: r.caption || '' })
  } else if (r.audio) {
    sent = await sock.sendMessage(target, { audio: { url: r.audio }, mimetype: 'audio/mpeg' })
  } else {
    sent = await sock.sendMessage(target, { text: r.text })
  }
  try {
    const label = r.text || r.caption || (r.image ? '[imagem]' : r.video ? '[vídeo]' : r.file ? `[${r.fileName || 'documento'}]` : r.audio ? '[áudio]' : '')
    // Mídia do fluxo já tem URL pública (Storage) — guarda pra aparecer no inbox.
    const mediaUrl = r.image || r.video || r.file || r.audio || null
    const mediaType = r.image ? 'image' : r.video ? 'video' : r.audio ? 'audio' : r.file ? 'document' : null
    await insertMessage({ contactId, jid: target, fromMe: true, text: label, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), companyId, mediaUrl, mediaType })
  } catch {}
}

function isMediaMsg(msg) {
  const m = unwrap(msg.message) || {}
  return !!(m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage)
}

// Tipo/extensão/mimetype da mídia (pra baixar e salvar com o nome certo).
function mediaInfo(msg) {
  const m = unwrap(msg.message) || {}
  if (m.imageMessage) return { type: 'image', ext: 'jpg', mimetype: m.imageMessage.mimetype || 'image/jpeg' }
  if (m.stickerMessage) return { type: 'image', ext: 'webp', mimetype: 'image/webp' }
  if (m.videoMessage) return { type: 'video', ext: 'mp4', mimetype: m.videoMessage.mimetype || 'video/mp4' }
  if (m.audioMessage) return { type: 'audio', ext: 'ogg', mimetype: m.audioMessage.mimetype || 'audio/ogg' }
  if (m.documentMessage) {
    const name = m.documentMessage.fileName || 'documento'
    return { type: 'document', ext: (name.split('.').pop() || 'bin'), mimetype: m.documentMessage.mimetype || 'application/octet-stream', fileName: name }
  }
  return null
}

// Baixa a mídia da mensagem e sobe no Storage; devolve { url, type } ou null.
async function fetchMedia(sock, msg) {
  const info = mediaInfo(msg)
  if (!info) return null
  try {
    // Baixa da mensagem desembrulhada (efêmera/ver-uma-vez também).
    const inner = { key: msg.key, message: unwrap(msg.message) }
    const buffer = await downloadMediaMessage(inner, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage })
    const name = info.fileName || `${msg.key.id}.${info.ext}`
    const url = await uploadMedia(buffer, name, info.mimetype)
    return { url, type: info.type }
  } catch (e) {
    console.error('fetchMedia:', e?.message || e)
    return null
  }
}

// Desembrulha mensagens "efêmeras"/"ver uma vez"/documento-com-legenda pra
// conseguir ler o conteúdo real (senão viria vazio / "não suportado").
function unwrap(m) {
  if (!m) return null
  return m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.viewOnceMessageV2Extension?.message || m.documentWithCaptionMessage?.message || m
}

function extractText(msg) {
  const m = unwrap(msg.message)
  if (!m) return null
  // Reação (emoji) do paciente a uma mensagem.
  if (m.reactionMessage) return m.reactionMessage.text ? `reagiu com ${m.reactionMessage.text}` : 'removeu a reação'
  // Resposta a MENU/botão (o que a pessoa escolheu — check-up, opção etc.).
  const escolha =
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  if (escolha) return String(escolha)
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    (m.imageMessage && '[imagem]') ||
    (m.audioMessage && (m.audioMessage.ptt ? '[áudio de voz]' : '[áudio]')) ||
    (m.videoMessage && '[vídeo]') ||
    (m.documentMessage && `[${m.documentMessage.fileName || 'documento'}]`) ||
    (m.stickerMessage && '[figurinha]') ||
    (m.locationMessage && '[localização]') ||
    (m.liveLocationMessage && '[localização ao vivo]') ||
    (m.contactMessage && `[contato: ${m.contactMessage.displayName || ''}]`) ||
    (m.contactsArrayMessage && '[contatos]') ||
    (m.pollCreationMessage && `[enquete] ${m.pollCreationMessage.name || ''}`) ||
    (m.pollCreationMessageV3 && `[enquete] ${m.pollCreationMessageV3.name || ''}`) ||
    (m.pollUpdateMessage && '[voto em enquete]') ||
    '[mensagem não reconhecida]'
  )
}

// Inicia (ou reinicia) a sessão de WhatsApp de UMA empresa.
async function startSession(companyId) {
  const s = getSession(companyId)

  // Fecha o socket anterior antes de criar outro (senão acumula e estoura a
  // memória no ciclo de reconexão).
  if (s.sock) {
    try { s.sock.ev.removeAllListeners() } catch {}
    try { s.sock.end(undefined) } catch {}
    s.sock = null
  }

  const dir = authDirFor(companyId)
  fs.mkdirSync(dir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(dir)
  const { version } = await fetchLatestBaileysVersion()

  // Proxy (anti-ban) — opcional, via PROXY_URL.
  let agent
  const proxyUrl = (process.env.PROXY_URL || '').trim()
  if (proxyUrl) {
    try {
      const { HttpsProxyAgent } = require('https-proxy-agent')
      const { SocksProxyAgent } = require('socks-proxy-agent')
      agent = proxyUrl.toLowerCase().startsWith('socks') ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl)
    } catch (e) {
      console.error('⚠️  Falha ao configurar o proxy (conectando direto):', e.message)
      agent = undefined
    }
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Ricco Chat', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    agent,
    fetchAgent: agent,
  })
  s.sock = sock

  sock.ev.on('creds.update', () => { if (!s.resetting) saveCreds() })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      s.qr = qr
      console.log(`\n📱 [empresa ${companyId}] Escaneie o QR (Aparelhos conectados › Conectar aparelho):\n`)
      qrcode.generate(qr, { small: true })
      QRImage.toFile(qrPathFor(companyId), qr, { width: 400, margin: 2 }, () => {})
    }

    if (connection === 'open') {
      s.waConnected = true
      s.qr = null
      console.log(`\n✅ [empresa ${companyId}] WhatsApp conectado!\n`)
    }

    if (connection === 'close') {
      s.waConnected = false
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      if (loggedOut) {
        // Deslogado: limpa SÓ esta empresa e reinicia a sessão dela pra gerar um
        // QR novo — sem derrubar as outras empresas (por isso não damos exit).
        console.log(`\n🚪 [empresa ${companyId}] Deslogado — limpando e gerando QR novo...\n`)
        s.resetting = true
        try { sock.ev.removeAllListeners() } catch {}
        wipeAuth(companyId)
        setTimeout(() => { s.resetting = false; startSession(companyId).catch(() => {}) }, 800)
      } else if (!s.reconnecting) {
        s.reconnecting = true
        console.log(`🔄 [empresa ${companyId}] Conexão caiu, reconectando em 5s...`)
        setTimeout(() => { s.reconnecting = false; startSession(companyId).catch(() => {}) }, 5000)
      }
    }
  })

  // Histórico (blocos ao conectar) → salva e marca conversas como Concluídas.
  sock.ev.on('messaging-history.set', async ({ contacts = [], messages = [] }) => {
    try {
      const nameByJid = {}
      for (const c of contacts) if (c.id && (c.name || c.notify)) nameByJid[c.id] = c.name || c.notify
      const lastByContact = {}
      let saved = 0
      for (const msg of messages) {
        const rawJid = msg.key?.remoteJid
        if (!rawJid || rawJid.endsWith('@g.us') || rawJid === 'status@broadcast') continue
        const fromMe = !!msg.key?.fromMe
        const jid = (!fromMe && (msg.key.senderPn || msg.key.participantPn)) || rawJid
        const text = extractText(msg)
        if (!text) continue
        const sentAt = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
        try {
          const contact = await upsertContact({ jid, phone: jid.split('@')[0], name: nameByJid[rawJid] || msg.pushName || null, companyId })
          await insertMessage({ contactId: contact.id, jid, fromMe, text, waMessageId: msg.key.id, sentAt, companyId })
          if (!lastByContact[contact.id] || sentAt > lastByContact[contact.id]) lastByContact[contact.id] = sentAt
          saved++
        } catch {}
      }
      for (const [contactId, updatedAt] of Object.entries(lastByContact)) await setSessionDone(contactId, updatedAt, companyId)
      if (saved > 0) console.log(`📥 [empresa ${companyId}] Histórico: ${saved} msgs de ${Object.keys(lastByContact).length} conversas → Concluídas`)
    } catch (e) {
      console.error('Erro ao sincronizar histórico:', e?.message || e)
    }
  })

  // Toda mensagem nova (recebida ou enviada).
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    s.diag.upsertEvents++
    s.diag.lastType = type
    if (type !== 'notify') return
    s.diag.notifyEvents++

    for (const msg of messages) {
      const rawJid = msg.key.remoteJid
      if (!rawJid || rawJid.endsWith('@g.us') || rawJid === 'status@broadcast') continue
      s.diag.processed++

      const fromMe = !!msg.key.fromMe
      const jid = (!fromMe && (msg.key.senderPn || msg.key.participantPn)) || rawJid
      let phone = jid.split('@')[0]
      if (jid.endsWith('@lid')) {
        phone = null
        try {
          const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid)
          if (pn) phone = String(pn).split('@')[0]
        } catch {}
      }
      const name = msg.pushName || null
      const text = extractText(msg)
      const sentAt = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString()

      try {
        const contact = await upsertContact({ jid, phone, name, companyId })
        // Mídia (imagem/áudio/vídeo/documento): baixa e sobe pro Storage pra
        // aparecer de verdade no inbox (antes só ficava o rótulo "[imagem]").
        let media = null
        if (isMediaMsg(msg)) media = await fetchMedia(sock, msg)
        await insertMessage({ contactId: contact.id, jid, fromMe, text, waMessageId: msg.key.id, sentAt, companyId, mediaUrl: media?.url, mediaType: media?.type })
        s.diag.saved++

        if (!fromMe && process.env.FETCH_AVATARS === 'true') {
          const last = contact.avatar_updated_at ? Date.parse(contact.avatar_updated_at) : 0
          if (Date.now() - last > 12 * 3600 * 1000) {
            const url = await sock.profilePictureUrl(rawJid, 'image').catch(() => null)
            await updateAvatar(contact.id, url)
          }
        }
        s.diag.lastFrom = name || phone
        s.diag.lastText = text
        console.log(`💬 [${companyId.slice(0, 8)}] ${fromMe ? 'nós →' : '→'} ${name || phone}: ${(text || '').slice(0, 60)}`)

        if (!fromMe && text) {
          const target = jid
          try {
            const settings = await getSettings(companyId).catch((e) => { s.diag.lastBotError = 'getSettings: ' + (e?.message || e); return null })
            if (settings && settings.bot_enabled === false) {
              s.diag.botPath = 'bot_desligado'
            } else {
              const { replies, tagOps } = await handleIncoming(contact.id, text, {
                reengageHours: settings?.reengage_hours ?? 12,
                isMedia: isMediaMsg(msg),
                defaultFlowId: settings?.default_flow_id ?? null,
                mediaFlowId: settings?.media_flow_id ?? null,
                companyId,
              })
              await applyTagOps(contact.id, tagOps).catch(() => {})
              s.diag.botPath = 'fluxo'
              s.diag.lastReplyCount = replies.length
              for (const r of replies) {
                await botSend(sock, target, r, settings, contact.id, companyId)
                s.diag.botReplies++
                console.log('   ↳ enviou:', (r.text || (r.image ? '[imagem]' : '')).slice(0, 40))
              }
            }
          } catch (err) {
            s.diag.lastBotError = err?.message || String(err)
            console.error('Erro no chatbot:', err?.message || err)
          }
        }
      } catch (err) {
        s.diag.lastError = err?.message || String(err)
        console.error('Erro ao salvar mensagem:', err.message)
      }
    }
  })

  // ── Ligações recebidas: recusa + avisa por mensagem ──
  // O paciente costuma ligar insistentemente; aqui o robô recusa a chamada (para
  // de tocar) e manda um texto explicando que o atendimento é só por mensagem.
  if (!s.handledCalls) s.handledCalls = new Set()      // callIds já tratados (o WhatsApp dispara o mesmo 'offer' várias vezes)
  if (!s.lastCallReplyAt) s.lastCallReplyAt = new Map() // jid -> ts do último aviso (anti-spam)
  sock.ev.on('call', async (calls) => {
    for (const call of calls || []) {
      try {
        if (call.status !== 'offer') continue // só o início da chamada
        const fromJid = call.from
        if (!fromJid || fromJid.endsWith('@g.us') || call.isGroup) continue
        if (s.handledCalls.has(call.id)) continue
        s.handledCalls.add(call.id)
        if (s.handledCalls.size > 1000) s.handledCalls.clear()

        // 1) recusa a chamada (para de tocar do lado do paciente)
        try { await sock.rejectCall(call.id, call.from) } catch (e) { s.diag.lastCallError = 'reject: ' + (e?.message || e) }

        // 2) anti-spam: no máx. 1 aviso a cada 10 min por contato
        const now = Date.now()
        if (now - (s.lastCallReplyAt.get(fromJid) || 0) < CALL_REPLY_COOLDOWN_MS) continue
        s.lastCallReplyAt.set(fromJid, now)

        // 3) manda o aviso (texto configurável por empresa)
        const settings = await getSettings(companyId).catch(() => null)
        if (settings && settings.call_reject_enabled === false) continue // empresa desligou o recurso
        const msgText = (settings?.call_reject_message && String(settings.call_reject_message).trim()) || DEFAULT_CALL_MSG
        const sent = await sock.sendMessage(fromJid, { text: msgText })

        // 4) registra no inbox pra o atendente ver
        const phone = fromJid.includes('@s.whatsapp.net') ? fromJid.split('@')[0] : null
        const contact = await upsertContact({ jid: fromJid, phone, name: null, companyId }).catch(() => null)
        if (contact) {
          await insertMessage({ contactId: contact.id, jid: fromJid, fromMe: true, text: msgText, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), companyId }).catch(() => {})
        }
        console.log(`📵 [${companyId.slice(0, 8)}] recusou ${call.isVideo ? 'vídeo' : 'ligação'} de ${phone || fromJid} + avisou`)
      } catch (e) {
        s.diag.lastCallError = e?.message || String(e)
        console.error('Erro ao tratar ligação:', e?.message || e)
      }
    }
  })

  return s
}

// Sobe todas as empresas que já pareamento um WhatsApp (têm creds.json).
async function bootAllSessions() {
  migrateFlatAuth()
  fs.mkdirSync(AUTH_ROOT, { recursive: true })
  let started = 0
  for (const entry of fs.readdirSync(AUTH_ROOT)) {
    const dir = path.join(AUTH_ROOT, entry)
    try {
      if (!fs.statSync(dir).isDirectory()) continue
      if (!fs.existsSync(path.join(dir, 'creds.json'))) continue // ainda não pareou
      await startSession(entry)
      started++
    } catch (e) {
      console.error(`Falha ao iniciar empresa ${entry}:`, e.message)
    }
  }
  // Garante que a Empresa #1 sempre tente subir (mesmo sem creds → gera QR).
  if (!sessions.has(SEED_COMPANY_ID)) {
    await startSession(SEED_COMPANY_ID).catch((e) => console.error('SEED:', e.message))
  }
  console.log(`🚀 ${started} empresa(s) com WhatsApp iniciadas.`)
}

// company da requisição (query ?company=), com fallback pra Empresa #1.
function companyFromReq(req) {
  try {
    const u = new URL(req.url, 'http://x')
    return u.searchParams.get('company') || SEED_COMPANY_ID
  } catch {
    return SEED_COMPANY_ID
  }
}

// ── Servidor HTTP: o painel manda mensagens e controla a conexão por aqui ──
http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

    // Status de UMA empresa (?company=) — ou visão geral de todas em /status/all.
    if (req.method === 'GET' && req.url.startsWith('/status')) {
      if (req.url.startsWith('/status/all')) {
        const all = {}
        for (const [cid, s] of sessions) all[cid] = { connected: !!s.sock, whatsapp: s.waConnected }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ companies: all }))
      }
      const cid = companyFromReq(req)
      const s = getSession(cid)
      // Auto-inicia a sessão de empresas ainda sem socket (ex.: empresa nova
      // recém-criada) pra o QR ser gerado sozinho — sem precisar clicar em
      // "Reiniciar conexão". Cooldown de 15s: se falhar, tenta de novo depois.
      if (!s.sock && !s.resetting && Date.now() - (s.autoStartAt || 0) > 15000) {
        s.autoStartAt = Date.now()
        startSession(cid).catch((e) => console.error('auto-start:', e.message))
      }
      const me = (s.sock?.user?.id || '').split(':')[0].split('@')[0] || null // número conectado
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ connected: !!s.sock, whatsapp: s.waConnected, me }))
    }

    if (req.method === 'GET' && req.url.startsWith('/debug')) {
      const cid = companyFromReq(req)
      const s = getSession(cid)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ company: cid, connected: !!s.sock, whatsapp: s.waConnected, baileys: BAILEYS_VERSION, keyInfo, sessions: [...sessions.keys()], ...s.diag }))
    }

    // Conectar/gerar QR de uma empresa (pareia um número novo). /connect?company=X
    if (req.method === 'GET' && req.url.startsWith('/connect')) {
      const cid = companyFromReq(req)
      startSession(cid).catch((e) => console.error('connect:', e.message))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, msg: 'gerando QR', company: cid }))
    }

    // Reset seguro de UMA empresa: apaga a sessão dela e gera QR novo (não
    // derruba as outras). /reset?company=X&confirm=yes
    if (req.method === 'GET' && req.url.startsWith('/reset')) {
      const u = new URL(req.url, 'http://x')
      if (u.searchParams.get('confirm') !== 'yes') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'use /reset?company=<id>&confirm=yes' }))
      }
      const cid = u.searchParams.get('company') || SEED_COMPANY_ID
      const s = getSession(cid)
      s.resetting = true
      try { s.sock?.ev.removeAllListeners() } catch {}
      try { s.sock?.end(undefined) } catch {}
      wipeAuth(cid)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, company: cid, msg: 'sessão apagada, gerando QR novo' }))
      setTimeout(() => { s.resetting = false; startSession(cid).catch(() => {}) }, 600)
      return
    }

    // QR pelo navegador (por empresa). /qr?company=X
    if (req.method === 'GET' && (req.url === '/qr' || req.url.startsWith('/qr?'))) {
      const cid = companyFromReq(req)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="text-align:center;font-family:sans-serif;padding-top:24px">
<h3>📱 Escaneie no WhatsApp<br><small>Aparelhos conectados › Conectar um aparelho</small></h3>
<img id="q" src="/qr.png?company=${cid}&t=${Date.now()}" width="320" style="max-width:90vw"/>
<p id="s" style="color:#888">O QR se atualiza sozinho. Pode escanear no seu tempo.</p>
<script>
setInterval(async()=>{
  try{const r=await fetch('/status?company=${cid}');const d=await r.json();
    if(d.whatsapp){document.getElementById('q').style.display='none';document.getElementById('s').innerHTML='✅ Conectado! Já pode fechar.';document.getElementById('s').style.color='green';return}}catch(e){}
  document.getElementById('q').src='/qr.png?company=${cid}&t='+Date.now()
},8000)
</script>
</body></html>`)
    }
    if (req.method === 'GET' && req.url.startsWith('/qr.png')) {
      const cid = companyFromReq(req)
      const p = qrPathFor(cid)
      if (fs.existsSync(p)) { res.writeHead(200, { 'Content-Type': 'image/png' }); return fs.createReadStream(p).pipe(res) }
      res.writeHead(404); return res.end()
    }

    // Envio de texto pelo inbox. body: { to, text, sentBy, contactId, company }
    if (req.method === 'POST' && req.url === '/send') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, text, sentBy, contactId, company } = JSON.parse(body || '{}')
          if (!to || !text) throw new Error('to e text obrigatórios')
          const s = getSession(company || SEED_COMPANY_ID)
          if (!s.sock || !s.waConnected) throw new Error('WhatsApp desconectado — reconecte escaneando o QR')
          await s.sock.sendPresenceUpdate('composing', to).catch(() => {})
          const sent = await s.sock.sendMessage(to, { text })
          try {
            await insertMessage({ contactId, jid: to, fromMe: true, text, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), sentBy, companyId: company || SEED_COMPANY_ID })
          } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // Envio de mídia pelo inbox. body: { to, kind, dataUrl, fileName, caption, sentBy, contactId, company }
    if (req.method === 'POST' && req.url === '/send-media') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, kind, dataUrl, fileName, caption, sentBy, contactId, company } = JSON.parse(body || '{}')
          if (!to || !dataUrl) throw new Error('to e dataUrl obrigatórios')
          const s = getSession(company || SEED_COMPANY_ID)
          if (!s.sock || !s.waConnected) throw new Error('WhatsApp desconectado — reconecte escaneando o QR')
          const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
          if (!m) throw new Error('dataUrl inválido')
          const mimetype = m[1]
          const buffer = Buffer.from(m[2], 'base64')
          let content
          if (kind === 'image') content = { image: buffer, caption: caption || '' }
          else if (kind === 'video') content = { video: buffer, caption: caption || '' }
          else content = { document: buffer, mimetype, fileName: fileName || 'arquivo' }
          const sent = await s.sock.sendMessage(to, content)
          const label = caption || (kind === 'image' ? '[imagem]' : kind === 'video' ? '[vídeo]' : `[${fileName || 'documento'}]`)
          // Sobe a mídia enviada pro Storage pra ela aparecer no inbox também.
          let mediaUrl = null
          const mediaType = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'document'
          try { mediaUrl = await uploadMedia(buffer, fileName || `envio.${(mimetype.split('/')[1] || 'bin')}`, mimetype) } catch {}
          try {
            await insertMessage({ contactId, jid: to, fromMe: true, text: label, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), sentBy, companyId: company || SEED_COMPANY_ID, mediaUrl, mediaType })
          } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // Editar uma mensagem NOSSA de texto no WhatsApp.
    // body: { to, waMessageId, text, company }
    if (req.method === 'POST' && req.url === '/edit-message') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, waMessageId, text, company } = JSON.parse(body || '{}')
          if (!to || !waMessageId || !text) throw new Error('to, waMessageId e text obrigatórios')
          const s = getSession(company || SEED_COMPANY_ID)
          if (!s.sock || !s.waConnected) throw new Error('WhatsApp desconectado')
          await s.sock.sendMessage(to, { text, edit: { remoteJid: to, fromMe: true, id: waMessageId } })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // Encaminhar (reenviar o conteúdo) pra outro contato.
    // body: { to, text, mediaUrl, mediaType, sentBy, contactId, company }
    if (req.method === 'POST' && req.url === '/forward') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, text, mediaUrl, mediaType, sentBy, contactId, company } = JSON.parse(body || '{}')
          if (!to) throw new Error('to obrigatório')
          const s = getSession(company || SEED_COMPANY_ID)
          if (!s.sock || !s.waConnected) throw new Error('WhatsApp desconectado')
          let sent, label
          if (mediaUrl) {
            const cap = text && !/^\[.*\]$/.test(text) ? text : ''
            const content = mediaType === 'image' ? { image: { url: mediaUrl }, caption: cap }
              : mediaType === 'video' ? { video: { url: mediaUrl }, caption: cap }
              : mediaType === 'audio' ? { audio: { url: mediaUrl }, mimetype: 'audio/mpeg' }
              : { document: { url: mediaUrl }, fileName: 'arquivo', caption: cap }
            sent = await s.sock.sendMessage(to, content)
            label = cap || (mediaType === 'image' ? '[imagem]' : mediaType === 'video' ? '[vídeo]' : mediaType === 'audio' ? '[áudio]' : '[documento]')
          } else {
            if (!text) throw new Error('nada pra encaminhar')
            sent = await s.sock.sendMessage(to, { text })
            label = text
          }
          try {
            await insertMessage({ contactId, jid: to, fromMe: true, text: label, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), sentBy, companyId: company || SEED_COMPANY_ID, mediaUrl: mediaUrl || null, mediaType: mediaType || null })
          } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // Apagar mensagem no WhatsApp (delete for everyone) — só as NOSSAS.
    // body: { to, waMessageId, company }
    if (req.method === 'POST' && req.url === '/delete-message') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, waMessageId, company } = JSON.parse(body || '{}')
          if (!to || !waMessageId) throw new Error('to e waMessageId obrigatórios')
          const s = getSession(company || SEED_COMPANY_ID)
          if (!s.sock || !s.waConnected) throw new Error('WhatsApp desconectado')
          await s.sock.sendMessage(to, { delete: { remoteJid: to, fromMe: true, id: waMessageId } })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end()
  })
  .listen(process.env.PORT || 3333, () => console.log(`🔌 API do conector na porta ${process.env.PORT || 3333} (multi-empresa)`))

bootAllSessions().catch((err) => {
  console.error('Falha ao iniciar:', err)
  process.exit(1)
})

// Desligamento limpo (redeploy/scale do Railway) — sai com código 0.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`\n↩️  Recebido ${sig} — desligando limpo.`)
    process.exit(0)
  })
}
