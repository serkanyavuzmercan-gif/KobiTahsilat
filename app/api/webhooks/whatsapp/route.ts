import { NextResponse } from 'next/server'
import { findCariKodByWhatsAppPhone, logWhatsAppYanit } from '@/lib/cari-yanitlar'
import { HATIRLATMA_LOG_KAYNAK } from '@/lib/hatirlatma-log'
import { normalizePhone } from '@/lib/phone'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type WhatsAppInboundMessage = {
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

type WhatsAppDeliveryStatus = {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>
}

type WhatsAppWebhookPayload = {
  object?: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppInboundMessage[]
        statuses?: WhatsAppDeliveryStatus[]
      }
    }>
  }>
}

const WHATSAPP_STATUS_TIP = 'tahsilat_whatsapp_durum'

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

async function logDeliveryStatus(status: WhatsAppDeliveryStatus) {
  if (!status.id || !status.status) return

  const error = status.errors?.[0]
  const preview = JSON.stringify({
    status: status.status,
    recipient_id: status.recipient_id || null,
    error_code: error?.code || null,
    error_title: error?.title || null,
    error_message: error?.message || null,
    error_details: error?.error_data?.details || null,
  })

  console.info('[whatsapp-webhook-status]', preview)

  if (status.status !== 'failed') return

  try {
    const admin = createAdminClient()
    const { error: insertError } = await admin.from('mail_gonderim_log').insert({
      ilgili_id: status.id,
      ilgili_tip: WHATSAPP_STATUS_TIP,
      mail_to: status.recipient_id || '',
      subject: `WhatsApp teslimat hatası · ${error?.code || 'unknown'}`,
      body_preview: preview,
      kaynak: HATIRLATMA_LOG_KAYNAK,
      sent_at: status.timestamp
        ? new Date(Number(status.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    })
    if (insertError) {
      console.error('[whatsapp-webhook-status-log]', insertError.message)
    }
  } catch (cause) {
    console.error('[whatsapp-webhook-status-log]', cause)
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as WhatsAppWebhookPayload
    const values =
      payload.entry?.flatMap((entry) => entry.changes?.map((change) => change.value) || []) || []

    const messages = values.flatMap((value) => value?.messages || [])
    const statuses = values.flatMap((value) => value?.statuses || [])

    for (const status of statuses) {
      await logDeliveryStatus(status)
    }

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
