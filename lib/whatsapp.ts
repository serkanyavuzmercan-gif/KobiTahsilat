import 'server-only'

export type WhatsAppSendResult = {
  id: string | null
}

export function whatsAppSendEnabled() {
  return process.env.WHATSAPP_SEND_ENABLED !== 'false'
}

function whatsAppAccessToken() {
  return process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || ''
}

function whatsAppPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || ''
}

export async function sendWhatsApp(options: { to: string; body: string }): Promise<WhatsAppSendResult> {
  const token = whatsAppAccessToken()
  const phoneNumberId = whatsAppPhoneNumberId()
  if (!token || !phoneNumberId) {
    throw new Error(
      'WhatsApp servisi yapılandırılmadı (WHATSAPP_ACCESS_TOKEN veya WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID).'
    )
  }

  const to = options.to.replace(/\D/g, '')
  if (!/^90\d{10}$/.test(to)) {
    throw new Error('Geçerli bir Türkiye telefon numarası gerekli.')
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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
      text: { preview_url: false, body: options.body },
    }),
  })

  const result = (await response.json()) as {
    messages?: Array<{ id: string }>
    error?: { message?: string; code?: number; error_subcode?: number }
  }

  if (!response.ok) {
    const detail = [
      result.error?.message,
      result.error?.error_subcode ? `kod: ${result.error.error_subcode}` : null,
    ]
      .filter(Boolean)
      .join(' — ')
    throw new Error(detail || 'WhatsApp mesajı gönderilemedi.')
  }

  if (!result.messages?.[0]?.id) {
    throw new Error('WhatsApp API yanıt verdi ancak mesaj kimliği dönmedi.')
  }

  return { id: result.messages[0].id }
}
