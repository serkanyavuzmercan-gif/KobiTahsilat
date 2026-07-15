import 'server-only'

export type WhatsAppSendResult = {
  id: string
  messageStatus: string | null
}

export type WhatsAppTemplateTextParameter = {
  type: 'text'
  text: string
}

export type WhatsAppTemplateComponent = {
  type: 'body' | 'header' | 'button'
  parameters?: WhatsAppTemplateTextParameter[]
  sub_type?: 'quick_reply' | 'url'
  index?: number
}

export type WhatsAppTemplateSummary = {
  name: string
  status: string
  language: string
  category?: string
}

type GraphError = {
  message?: string
  code?: number
  error_subcode?: number
  error_user_msg?: string
}

type GraphMessageResponse = {
  messages?: Array<{ id: string; message_status?: string }>
  error?: GraphError
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

function whatsAppBusinessAccountId() {
  return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''
}

export function normalizeWhatsAppRecipient(to: string) {
  const digits = to.replace(/\D/g, '')
  if (!/^90\d{10}$/.test(digits)) {
    throw new Error('Geçerli bir Türkiye cep telefonu gerekli (905xxxxxxxxx).')
  }
  return digits
}

async function postWhatsAppMessage(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const token = whatsAppAccessToken()
  const phoneNumberId = whatsAppPhoneNumberId()
  if (!token || !phoneNumberId) {
    throw new Error(
      'WhatsApp servisi yapılandırılmadı (WHATSAPP_TOKEN veya WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).'
    )
  }

  const response = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const raw = await response.text()
  let result: GraphMessageResponse = {}

  try {
    result = JSON.parse(raw) as GraphMessageResponse
  } catch {
    throw new Error(`WhatsApp API geçersiz yanıt (${response.status}).`)
  }

  if (!response.ok) {
    const detail = [
      result.error?.message,
      result.error?.error_user_msg,
      result.error?.error_subcode ? `kod: ${result.error.error_subcode}` : null,
      result.error?.code ? `api: ${result.error.code}` : null,
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

/** SS/tawkto ile aynı env isimleri: WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID */
export async function sendWhatsApp(options: { to: string; body: string }): Promise<WhatsAppSendResult> {
  const to = normalizeWhatsAppRecipient(options.to)
  const body = options.body.trim().slice(0, 4096)
  if (!body) throw new Error('Mesaj metni boş olamaz.')

  return postWhatsAppMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body },
  })
}

/** İşletme başlattığı mesajlar için Meta onaylı şablon zorunludur. */
export async function sendWhatsAppTemplate(options: {
  to: string
  templateName: string
  languageCode: string
  components?: WhatsAppTemplateComponent[]
}): Promise<WhatsAppSendResult> {
  const to = normalizeWhatsAppRecipient(options.to)
  const templateName = options.templateName.trim()
  const languageCode = options.languageCode.trim()
  if (!templateName) throw new Error('WhatsApp şablon adı gerekli.')
  if (!languageCode) throw new Error('WhatsApp şablon dili gerekli.')

  return postWhatsAppMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(options.components?.length ? { components: options.components } : {}),
    },
  })
}

async function resolveBusinessAccountId(): Promise<string> {
  const configured = whatsAppBusinessAccountId()
  if (configured) return configured

  const token = whatsAppAccessToken()
  const phoneNumberId = whatsAppPhoneNumberId()
  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp WABA kimliği için token ve phone number id gerekli.')
  }

  const response = await fetch(`${GRAPH}/${phoneNumberId}?fields=whatsapp_business_account`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const raw = await response.text()
  let result: { whatsapp_business_account?: { id?: string }; error?: GraphError } = {}
  try {
    result = JSON.parse(raw) as typeof result
  } catch {
    throw new Error(`WhatsApp WABA sorgusu geçersiz yanıt (${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(result.error?.message || `WhatsApp WABA sorgusu başarısız (${response.status}).`)
  }
  const wabaId = result.whatsapp_business_account?.id
  if (!wabaId) throw new Error('WhatsApp Business Account kimliği bulunamadı.')
  return wabaId
}

export async function listWhatsAppTemplates(limit = 50): Promise<WhatsAppTemplateSummary[]> {
  const token = whatsAppAccessToken()
  if (!token) throw new Error('WhatsApp token yapılandırılmadı.')

  const wabaId = await resolveBusinessAccountId()
  const response = await fetch(
    `${GRAPH}/${wabaId}/message_templates?limit=${limit}&fields=name,status,language,category`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const raw = await response.text()
  let result: {
    data?: Array<{ name?: string; status?: string; language?: string; category?: string }>
    error?: GraphError
  } = {}
  try {
    result = JSON.parse(raw) as typeof result
  } catch {
    throw new Error(`Şablon listesi geçersiz yanıt (${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(result.error?.message || `Şablon listesi alınamadı (${response.status}).`)
  }

  return (result.data || [])
    .filter((item) => item.name && item.language)
    .map((item) => ({
      name: String(item.name),
      status: String(item.status || 'UNKNOWN'),
      language: String(item.language),
      category: item.category ? String(item.category) : undefined,
    }))
}

export { WHATSAPP_SENDER_LABEL } from './whatsapp-constants'
