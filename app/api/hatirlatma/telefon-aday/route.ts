import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { toErrorMessage } from '@/lib/errors'
import {
  HATIRLATMA_LOG_KAYNAK,
  WHATSAPP_PHONE_DISMISS_TIP,
} from '@/lib/hatirlatma-log'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cariKod?: string; telefon?: string }
    const cariKod = String(body.cariKod || '').trim()
    const telefon = String(body.telefon || '').trim()
    const cari = await getCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }
    if (!telefon) {
      return NextResponse.json({ success: false, error: 'Telefon gerekli.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('mail_gonderim_log').insert({
      mail_to: telefon,
      subject: 'WhatsApp telefon adayı reddedildi',
      body_preview: `${cari.firma_adi} için aday gizlendi`,
      kaynak: HATIRLATMA_LOG_KAYNAK,
      ilgili_id: cariKod,
      ilgili_tip: WHATSAPP_PHONE_DISMISS_TIP,
      sent_at: new Date().toISOString(),
    })
    if (error) throw error

    return NextResponse.json({ success: true, message: 'Telefon önerisi gizlendi.' })
  } catch (cause) {
    console.error('[hatirlatma-telefon-aday]', cause)
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'Öneri gizlenemedi.') },
      { status: 500 }
    )
  }
}
