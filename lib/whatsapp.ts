import 'server-only'

export type WhatsAppSendResult = {
  id: string
  messageStatus: string | null
}

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`

export function whatsAppConfigured() {
  return Boolean(
    (process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN) &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
  )
}

export function whatsAppSendEnabled() {
  return process.env.WHATSAPP_SEND_ENABLED !== 'false'
}

function whatsAppAccessToken() {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || ''
}

function whatsAppPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || ''
}

/** SS/tawkto ile aynı env isimleri: WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID */
export async function sendWhatsApp(options: { to: string; body: string }): Promise<WhatsAppSendResult> {
  const token = whatsAppAccessToken()
  const phoneNumberId = whatsAppPhoneNumberId()
  if (!token || !phoneNumberId) {
    throw new Error(
      'WhatsApp servisi yapılandırılmadı (WHATSAPP_TOKEN veya WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).'
    )
  }

  const to = options.to.replace(/\D/g, '')
  if (!/^90\d{10}$/.test(to)) {
    throw new Error('Geçerli bir Türkiye cep telefonu gerekli (905xxxxxxxxx).')
  }

  const body = options.body.trim().slice(0, 4096)
  if (!body) throw new Error('Mesaj metni boş olamaz.')

  const response = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  })

  const raw = await response.text()
  let result: {
    messages?: Array<{ id: string; message_status?: string }>
    error?: { message?: string; code?: number; error_subcode?: number }
  } = {}

  try {
    result = JSON.parse(raw) as typeof result
  } catch {
    throw new Error(`WhatsApp API geçersiz yanıt (${response.status}).`)
  }

  if (!response.ok) {
    const detail = [
      result.error?.message,
      result.error?.error_subcode ? `kod: ${result.error.error_subcode}` : null,
    ]
      .filter(Boolean)
      .join(' — ')
    console.error('[whatsapp] gönderim hatası', response.status, raw.slice(0, 500))
    throw new Error(detail || `WhatsApp mesajı gönderilemedi (${response.status}).`)
  }

  const message = result.messages?.[0]
  if (!message?.id) {
    console.error('[whatsapp] mesaj kimliği yok', raw.slice(0, 500))
    throw new Error('WhatsApp API yanıt verdi ancak mesaj kimliği dönmedi.')
  }

  return {
    id: message.id,
    messageStatus: message.message_status || null,
  }
}

export { WHATSAPP_SENDER_LABEL } from './whatsapp-constants'
