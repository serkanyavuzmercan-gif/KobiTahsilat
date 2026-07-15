import 'server-only'
import crypto from 'crypto'

/**
 * Gmail API ile e-posta gönderimi (Workspace, domain-wide delegation).
 *
 * ss `lib/gmail-api.ts` ile aynı servis hesabı (GOOGLE_SA_KEY_B64) kullanılır; burada
 * GÖNDERİM için `gmail.send` scope'uyla `GMAIL_SENDER` kutusu impersonate edilir. Resend'e
 * para vermemek için birincil gönderim yolu budur (Resend yalnızca yedek).
 *
 * ⚠️ Gereken DWD scope (Google Admin > Güvenlik > API denetimleri > alan genelinde yetki):
 *    https://www.googleapis.com/auth/gmail.send  → GMAIL_SENDER kutusu için yetkilendirilmeli.
 *    Env: GOOGLE_SA_KEY_B64 (servis hesabı, base64 JSON) + GMAIL_SENDER (ör. serkan.mercan@hidroteknik.com.tr)
 */

type SAKey = { client_email: string; private_key: string; token_uri: string }

function loadSA(): SAKey {
  const b64 = process.env.GOOGLE_SA_KEY_B64
  if (!b64) throw new Error('GOOGLE_SA_KEY_B64 tanımlı değil (Gmail gönderim)')
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
}

const b64url = (buf: Buffer | string): string => Buffer.from(buf).toString('base64url')
const SCOPE_SEND = ['https://www.googleapis.com/auth/gmail.send']
const tokenCache = new Map<string, { token: string; exp: number }>()

/** Domain-wide delegation: `subject` kutusu adına kısa ömürlü gmail.send access token'ı üretir. */
async function getAccessToken(subject: string): Promise<string> {
  const cacheKey = `${subject}|send`
  const now = Math.floor(Date.now() / 1000)
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.exp - 60 > now) return cached.token

  const sa = loadSA()
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: subject,
      scope: SCOPE_SEND.join(' '),
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  )
  const data = `${header}.${claims}`
  const sig = crypto.createSign('RSA-SHA256').update(data).sign(sa.private_key)
  const jwt = `${data}.${b64url(sig)}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const j = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!j.access_token) {
    throw new Error(
      'Gmail token alınamadı: ' +
        (j.error_description || j.error || JSON.stringify(j).slice(0, 200)) +
        ' (gmail.send DWD scope eklenmiş mi?)'
    )
  }
  tokenCache.set(cacheKey, { token: j.access_token, exp: now + (j.expires_in || 3600) })
  return j.access_token
}

/** Başlık değerini yalnız ASCII değilse RFC2047 (=?UTF-8?B?…?=) ile kodlar. */
function encodeHeaderWord(value: string): string {
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** base64 gövdeyi 76 karakterde CRLF ile sarar (RFC uyumu). */
function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

/** "Ad <email>" veya "email" formatını ayrıştırır. */
function parseFrom(from: string | undefined, fallbackAddress: string): { name: string; address: string } {
  if (from) {
    const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
    if (m) return { name: m[1].trim(), address: m[2].trim() }
    if (from.includes('@')) return { name: '', address: from.trim() }
    return { name: from.trim(), address: fallbackAddress }
  }
  return { name: '', address: fallbackAddress }
}

export function gmailSendConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SA_KEY_B64 && process.env.GMAIL_SENDER)
}

export async function sendGmail(options: {
  to: string[]
  subject: string
  html: string
  text: string
  from?: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: string; contentType: string }>
}): Promise<{ id: string | null }> {
  const sender = (process.env.GMAIL_SENDER || '').trim()
  if (!sender) throw new Error('GMAIL_SENDER tanımlı değil.')
  if (!options.to.length) throw new Error('Alıcı yok.')

  // From: her zaman impersonate edilen kutu (Gmail farklı From adresini reddeder); görünen ad korunur.
  const parsed = parseFrom(options.from, sender)
  const displayName = parsed.name || 'Hidroteknik A.Ş.'
  const fromHeader = `${encodeHeaderWord(displayName)} <${sender}>`
  // Reply-To: açık replyTo, yoksa özgün From adresi (ör. finans@) → yanıtlar oraya gider.
  const replyToAddr =
    options.replyTo || (parsed.address && parsed.address !== sender ? parsed.address : '')

  const boundaryAlt = 'alt_' + crypto.randomBytes(10).toString('hex')
  const altBody =
    `--${boundaryAlt}\r\n` +
    'Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    wrap76(Buffer.from(options.text, 'utf8').toString('base64')) +
    `\r\n--${boundaryAlt}\r\n` +
    'Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    wrap76(Buffer.from(options.html, 'utf8').toString('base64')) +
    `\r\n--${boundaryAlt}--\r\n`

  const headers = [
    `From: ${fromHeader}`,
    `To: ${options.to.join(', ')}`,
    ...(replyToAddr ? [`Reply-To: ${replyToAddr}`] : []),
    `Subject: ${encodeHeaderWord(options.subject)}`,
    'MIME-Version: 1.0',
  ]

  const attachments = options.attachments || []
  let raw: string
  if (attachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`)
    raw = headers.join('\r\n') + '\r\n\r\n' + altBody
  } else {
    const boundaryMix = 'mix_' + crypto.randomBytes(10).toString('hex')
    headers.push(`Content-Type: multipart/mixed; boundary="${boundaryMix}"`)
    let body =
      `--${boundaryMix}\r\n` +
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"\r\n\r\n` +
      altBody +
      '\r\n'
    for (const att of attachments) {
      const safeName = att.filename.replace(/["\r\n]/g, '')
      body +=
        `--${boundaryMix}\r\n` +
        `Content-Type: ${att.contentType}; name="${safeName}"\r\n` +
        'Content-Transfer-Encoding: base64\r\n' +
        `Content-Disposition: attachment; filename="${safeName}"\r\n\r\n` +
        wrap76(att.content) +
        '\r\n'
    }
    body += `--${boundaryMix}--\r\n`
    raw = headers.join('\r\n') + '\r\n\r\n' + body
  }

  const token = await getAccessToken(sender)
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(Buffer.from(raw, 'utf8')) }),
  })
  if (!res.ok) {
    throw new Error(`Gmail gönderim hatası (${res.status}): ${(await res.text()).slice(0, 400)}`)
  }
  const j = (await res.json()) as { id?: string }
  return { id: j.id || null }
}
