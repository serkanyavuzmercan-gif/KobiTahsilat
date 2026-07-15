import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import {
  loadWhatsAppUserConnection,
  saveWhatsAppUserConnection,
} from '@/lib/automation/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuthUser()
    const connection = await loadWhatsAppUserConnection(user.id)
    return NextResponse.json({ success: true, connection })
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'WhatsApp bağlantısı yüklenemedi.') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { telefon?: string }
    const telefon = String(body.telefon || '').trim()
    if (!telefon) {
      return NextResponse.json({ success: false, error: 'Telefon numarası gerekli.' }, { status: 400 })
    }

    const connection = await saveWhatsAppUserConnection(user.id, telefon)
    return NextResponse.json({
      success: true,
      connection,
      message: 'WhatsApp iletişim numaranız kaydedildi.',
    })
  } catch (cause) {
    const message = toErrorMessage(cause, 'WhatsApp bağlantısı kaydedilemedi.')
    const status = message.includes('Oturum') ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
