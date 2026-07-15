import { NextResponse } from 'next/server'
import { findCariKodByWhatsAppPhone, logWhatsAppYanit } from '@/lib/cari-yanitlar'
import { normalizePhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'

type WhatsAppInboundMessage = {
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

type WhatsAppWebhookPayload = {
  object?: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppInboundMessage[]
      }
    }>
  }>
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const verifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ success: false, error: 'Doğrulama başarısız.' }, { status: 403 })
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as WhatsAppWebhookPayload
    const messages =
      payload.entry?.flatMap((entry) =>
        entry.changes?.flatMap((change) => change.value?.messages || []) || []
      ) || []

    for (const message of messages) {
      if (message.type !== 'text' || !message.text?.body || !message.from) continue

      const telefon = normalizePhone(message.from)
      if (!telefon) continue

      const cariKod = await findCariKodByWhatsAppPhone(message.from)
      if (!cariKod) {
        console.warn('[whatsapp-webhook] eşleşmeyen numara:', message.from)
        continue
      }

      await logWhatsAppYanit({
        cariKod,
        telefon,
        mesaj: message.text.body.trim(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error('[whatsapp-webhook]', cause)
    return NextResponse.json({ success: true })
  }
}
