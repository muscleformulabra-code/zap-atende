// ─────────────────────────────────────────────────────────────
//  RICCO CHAT — Conector WhatsApp (Fase 1: Fundação)
//  Conecta o WhatsApp por QR code e salva TODO contato e mensagem
//  automaticamente no banco (Supabase).
// ─────────────────────────────────────────────────────────────
require('dotenv').config()

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const QRImage = require('qrcode')
const path = require('path')
const http = require('http')
const fs = require('fs')
const pino = require('pino')

const { upsertContact, insertMessage, updateAvatar, keyInfo } = require('./supabase')
const BAILEYS_VERSION = (() => { try { return require('@whiskeysockets/baileys/package.json').version } catch { return '?' } })()
const { handleIncoming, getSettings, isWithinHours } = require('./bot')

// Socket do WhatsApp (nível de módulo p/ o servidor HTTP do inbox usar).
let sock = null
let waConnected = false // true quando o WhatsApp está autenticado/conectado
let resetting = false // quando true, não salva credenciais (evita recriar sessão no reset)
// Diagnóstico: contadores pra saber onde o fluxo de mensagem trava.
const diag = { upsertEvents: 0, notifyEvents: 0, processed: 0, saved: 0, botReplies: 0, botPath: null, lastReplyCount: null, lastBotError: null, lastError: null, lastFrom: null, lastText: null, lastType: null }

// Apaga os ARQUIVOS de sessão dentro de ./auth (não a pasta — é ponto de
// montagem do volume no Railway e daria EBUSY). Usado no logout e no /reset.
function wipeAuth() {
  const removed = []
  try {
    const authDir = path.join(__dirname, 'auth')
    for (const f of fs.readdirSync(authDir)) {
      fs.rmSync(path.join(authDir, f), { recursive: true, force: true })
      removed.push(f)
    }
  } catch (e) { diag.lastError = 'wipeAuth: ' + (e.message || e) }
  return removed
}

// Envia uma resposta do bot (texto OU imagem) com "digitando…" e atraso
// aleatório (humanizado) — salvaguarda anti-ban.
async function botSend(sock, target, reply, settings) {
  const r = typeof reply === 'string' ? { text: reply } : reply
  const min = settings?.min_delay_ms ?? 1200
  const max = Math.max(settings?.max_delay_ms ?? 3500, min)
  const wait = Math.floor(min + Math.random() * (max - min))
  try {
    await sock.sendPresenceUpdate('composing', target)
  } catch {}
  await new Promise((res) => setTimeout(res, wait))
  if (r.image) {
    await sock.sendMessage(target, { image: { url: r.image }, caption: r.caption || '' })
  } else {
    await sock.sendMessage(target, { text: r.text })
  }
}

// A mensagem é um anexo de mídia? (foto, vídeo, áudio, documento, figurinha)
function isMediaMsg(msg) {
  const m = msg.message || {}
  return !!(m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage)
}

// Extrai o texto de uma mensagem (ou um rótulo para mídia).
function extractText(msg) {
  const m = msg.message
  if (!m) return null
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    (m.imageMessage && '[imagem]') ||
    (m.audioMessage && '[áudio]') ||
    (m.documentMessage && '[documento]') ||
    (m.stickerMessage && '[figurinha]') ||
    (m.locationMessage && '[localização]') ||
    (m.contactMessage && '[contato]') ||
    null
  )
}

async function start() {
  // Salva a sessão do WhatsApp na pasta ./auth (não precisa reescanear toda vez).
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const { version } = await fetchLatestBaileysVersion()

  // Proxy (anti-ban): rota a conexão por um IP fixo — de preferência do Brasil —
  // pra o WhatsApp ver o "aparelho" sempre no mesmo lugar. Defina PROXY_URL no
  // ambiente do conector, ex.:  http://user:senha@host:porta  ou  socks5://...
  // Sem PROXY_URL, conecta direto (comportamento normal).
  let agent
  const proxyUrl = (process.env.PROXY_URL || '').trim()
  if (proxyUrl) {
    try {
      const { HttpsProxyAgent } = require('https-proxy-agent')
      const { SocksProxyAgent } = require('socks-proxy-agent')
      agent = proxyUrl.toLowerCase().startsWith('socks') ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl)
      console.log('🌐 Conectando via proxy:', proxyUrl.replace(/\/\/[^@]*@/, '//***:***@'))
    } catch (e) {
      console.error('⚠️  Falha ao configurar o proxy (conectando direto):', e.message)
      agent = undefined
    }
  }

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Ricco Chat', 'Chrome', '1.0.0'],
    agent,        // WebSocket do WhatsApp pelo proxy
    fetchAgent: agent, // downloads de mídia pelo proxy
  })

  sock.ev.on('creds.update', () => { if (!resetting) saveCreds() })

  // Conexão: mostra o QR, avisa quando conecta, reconecta se cair.
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n📱 Abra o WhatsApp do CHIP DO BOT > Aparelhos conectados > Conectar aparelho')
      console.log('   e escaneie o QR abaixo:\n')
      qrcode.generate(qr, { small: true })
      // Também salva o QR como imagem (mais fácil de escanear).
      const out = path.join(__dirname, 'qr.png')
      QRImage.toFile(out, qr, { width: 400, margin: 2 }, (err) => {
        if (!err) console.log(`🖼️  QR também salvo em: ${out}`)
      })
    }

    if (connection === 'open') {
      waConnected = true
      console.log('\n✅ WhatsApp conectado! Agora é só mandar uma mensagem pro número que os contatos começam a aparecer no banco.\n')
    }

    if (connection === 'close') {
      waConnected = false
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      if (loggedOut) {
        // Deslogado (aparelho removido / sessão expirada): limpa a sessão e
        // reinicia sozinho pra gerar um QR novo. Antes ele TRAVAVA aqui.
        console.log('\n🚪 Deslogado — limpando sessão e reiniciando para gerar QR novo...\n')
        resetting = true
        wipeAuth()
        setTimeout(() => process.exit(0), 400) // Railway reinicia -> QR novo em /qr
      } else {
        console.log('🔄 Conexão caiu, reconectando...')
        start()
      }
    }
  })

  // Toda mensagem nova (recebida ou enviada) passa por aqui.
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    diag.upsertEvents++
    diag.lastType = type
    if (type !== 'notify') return
    diag.notifyEvents++

    for (const msg of messages) {
      const rawJid = msg.key.remoteJid
      // Ignora grupos e status (só conversa 1-a-1 com paciente).
      if (!rawJid || rawJid.endsWith('@g.us') || rawJid === 'status@broadcast') continue
      diag.processed++

      const fromMe = !!msg.key.fromMe
      if (!fromMe) {
        diag.lastRawJid = rawJid
        diag.lastSenderPn = msg.key.senderPn || null
        diag.lastParticipant = msg.key.participant || msg.key.participantPn || null
      }
      // WhatsApp novo usa @lid; normaliza pro número real (senderPn) quando recebemos.
      const jid = (!fromMe && (msg.key.senderPn || msg.key.participantPn)) || rawJid
      const phone = jid.split('@')[0]
      const name = msg.pushName || null
      const text = extractText(msg)
      const sentAt = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      try {
        const contact = await upsertContact({ jid, phone, name })
        await insertMessage({
          contactId: contact.id,
          jid,
          fromMe,
          text,
          waMessageId: msg.key.id,
          sentAt,
        })
        diag.saved++

        // Foto de perfil — DESLIGADA por padrão (modo anti-ban): consultar foto
        // de muitos contatos vira sinal de scraping pro WhatsApp. Só liga se
        // definir FETCH_AVATARS=true no ambiente do conector.
        if (!fromMe && process.env.FETCH_AVATARS === 'true') {
          const last = contact.avatar_updated_at ? Date.parse(contact.avatar_updated_at) : 0
          if (Date.now() - last > 12 * 3600 * 1000) {
            const url = await sock.profilePictureUrl(rawJid, 'image').catch(() => null)
            await updateAvatar(contact.id, url)
          }
        }
        diag.lastFrom = name || phone
        diag.lastText = text
        const arrow = fromMe ? 'nós →' : '→'
        console.log(`💬 ${arrow} ${name || phone}: ${(text || '').slice(0, 60)}`)

        // Chatbot: só responde a mensagens do paciente (não às nossas).
        if (!fromMe && text) {
          const target = jid // já normalizado pro número real
          try {
            const settings = await getSettings().catch((e) => { diag.lastBotError = 'getSettings: ' + (e?.message || e); return null })
            if (settings && settings.bot_enabled === false) {
              diag.botPath = 'bot_desligado'
            } else {
              // Sem mensagem de "fora de horário": o bot responde/roteia sempre.
              const { replies } = await handleIncoming(contact.id, text, {
                reengageHours: settings?.reengage_hours ?? 12,
                isMedia: isMediaMsg(msg),
                defaultFlowId: settings?.default_flow_id ?? null,
                mediaFlowId: settings?.media_flow_id ?? null,
              })
              diag.botPath = 'fluxo'
              diag.lastReplyCount = replies.length
              for (const r of replies) {
                await botSend(sock, target, r, settings)
                diag.botReplies++
                console.log('   ↳ enviou:', (r.text || (r.image ? '[imagem]' : '')).slice(0, 40))
              }
            }
          } catch (err) {
            diag.lastBotError = err?.message || String(err)
            console.error('Erro no chatbot:', err?.message || err, err?.stack || '')
          }
        }
      } catch (err) {
        diag.lastError = err?.message || String(err)
        console.error('Erro ao salvar mensagem:', err.message)
      }
    }
  })
}

// ── Servidor HTTP: o painel (inbox) manda mensagens pelo WhatsApp por aqui ──
http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ connected: !!sock, whatsapp: waConnected }))
    }
    if (req.method === 'GET' && req.url === '/debug') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ connected: !!sock, whatsapp: waConnected, baileys: BAILEYS_VERSION, keyInfo, ...diag }))
    }
    // Reset seguro: apaga a sessão do WhatsApp e reinicia (gera QR novo p/ re-parear).
    // /reset?confirm=yes
    if (req.method === 'GET' && req.url.startsWith('/reset')) {
      const u = new URL(req.url, 'http://x')
      if (u.searchParams.get('confirm') !== 'yes') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'use /reset?confirm=yes' }))
      }
      resetting = true // impede que creds.update recrie a sessão
      const removed = wipeAuth()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, removed, msg: 'sessão apagada, reiniciando para gerar QR novo' }))
      setTimeout(() => process.exit(0), 400) // Railway reinicia o container
      return
    }
    // Diagnóstico: testa se um número está no WhatsApp e envia uma msg de teste.
    // /testsend?num=5561983741339&text=oi  -> resolve o jid via onWhatsApp e envia.
    if (req.method === 'GET' && req.url.startsWith('/testsend')) {
      const u = new URL(req.url, 'http://x')
      const num = (u.searchParams.get('num') || '').replace(/\D/g, '')
      const rawJid = u.searchParams.get('jid') || '' // envia direto pra esse jid (ex.: ...@lid)
      const text = u.searchParams.get('text') || 'teste'
      ;(async () => {
        try {
          if (!sock) throw new Error('sock nulo')
          // Modo 1: jid cru (ex.: @lid) — envia direto.
          if (rawJid) {
            const sent = await sock.sendMessage(rawJid, { text })
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ sentTo: rawJid, id: sent?.key?.id }))
          }
          // Modo 2: número — resolve via onWhatsApp e envia.
          const check = await sock.onWhatsApp(num).catch((e) => ({ err: e.message }))
          let sendResult = null
          if (Array.isArray(check) && check[0]?.exists) {
            const sent = await sock.sendMessage(check[0].jid, { text })
            sendResult = { to: check[0].jid, id: sent?.key?.id }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ num, onWhatsApp: check, sendResult }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })()
      return
    }
    // QR pelo navegador (útil quando o conector está no servidor remoto).
    if (req.method === 'GET' && req.url === '/qr') {
      const p = path.join(__dirname, 'qr.png')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="text-align:center;font-family:sans-serif;padding-top:24px">
<h3>📱 Escaneie no WhatsApp<br><small>Aparelhos conectados › Conectar um aparelho</small></h3>
<img id="q" src="/qr.png?t=${Date.now()}" width="320" style="max-width:90vw"/>
<p id="s" style="color:#888">O QR se atualiza sozinho. Pode escanear no seu tempo.</p>
<script>
setInterval(async()=>{
  try{const r=await fetch('/status');const d=await r.json();
    if(d.whatsapp){document.getElementById('q').style.display='none';document.getElementById('s').innerHTML='✅ Conectado! Já pode fechar.';document.getElementById('s').style.color='green';return}}catch(e){}
  document.getElementById('q').src='/qr.png?t='+Date.now()
},8000)
</script>
</body></html>`)
    }
    if (req.method === 'GET' && req.url.startsWith('/qr.png')) {
      const p = path.join(__dirname, 'qr.png')
      if (fs.existsSync(p)) { res.writeHead(200, { 'Content-Type': 'image/png' }); return fs.createReadStream(p).pipe(res) }
      res.writeHead(404); return res.end()
    }
    if (req.method === 'POST' && req.url === '/send') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, text, sentBy, contactId } = JSON.parse(body || '{}')
          if (!to || !text) throw new Error('to e text obrigatórios')
          if (!sock || !waConnected) throw new Error("WhatsApp desconectado — reconecte escaneando o QR")
          await sock.sendPresenceUpdate('composing', to).catch(() => {})
          const sent = await sock.sendMessage(to, { text })
          // Salva já atribuído ao atendente. O echo posterior é deduplicado pelo wa_message_id.
          try {
            await insertMessage({ contactId, jid: to, fromMe: true, text, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), sentBy })
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
    // Envia mídia (foto, vídeo ou PDF/documento) pelo inbox. Recebe o arquivo
    // em base64 (dataUrl) — sem depender de storage externo.
    if (req.method === 'POST' && req.url === '/send-media') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        try {
          const { to, kind, dataUrl, fileName, caption, sentBy, contactId } = JSON.parse(body || '{}')
          if (!to || !dataUrl) throw new Error('to e dataUrl obrigatórios')
          if (!sock || !waConnected) throw new Error("WhatsApp desconectado — reconecte escaneando o QR")
          const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
          if (!m) throw new Error('dataUrl inválido')
          const mimetype = m[1]
          const buffer = Buffer.from(m[2], 'base64')
          let content
          if (kind === 'image') content = { image: buffer, caption: caption || '' }
          else if (kind === 'video') content = { video: buffer, caption: caption || '' }
          else content = { document: buffer, mimetype, fileName: fileName || 'arquivo' }
          const sent = await sock.sendMessage(to, content)
          const label = caption || (kind === 'image' ? '[imagem]' : kind === 'video' ? '[vídeo]' : `[${fileName || 'documento'}]`)
          try {
            await insertMessage({ contactId, jid: to, fromMe: true, text: label, waMessageId: sent?.key?.id, sentAt: new Date().toISOString(), sentBy })
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
    res.writeHead(404)
    res.end()
  })
  .listen(process.env.PORT || 3333, () => console.log(`🔌 API do conector na porta ${process.env.PORT || 3333} (envio pelo inbox + /qr)`))

start().catch((err) => {
  console.error('Falha ao iniciar:', err)
  process.exit(1)
})

// Desligamento LIMPO quando o Railway manda parar (redeploy/scale) — sai com
// código 0 pra não ser reportado como "crash" (fim dos emails de Deploy Crashed).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`\n↩️  Recebido ${sig} — desligando limpo.`)
    process.exit(0)
  })
}
