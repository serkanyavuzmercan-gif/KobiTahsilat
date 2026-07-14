import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { toErrorMessage } from '@/lib/errors'
import { HATIRLATMA_LOG_KAYNAK, WHATSAPP_PHONE_OVERRIDE_TIP } from '@/lib/hatirlatma-log'
import { parsePhones, formatPhoneDisplay } from '@/lib/phone'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cariKod?: string; telefon?: string }
    const cariKod = String(body.cariKod || '').trim()
    const cari = getCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }

    const raw = String(body.telefon || '').trim()
    const phoneList = parsePhones(raw)
    if (raw && !phoneList.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçerli telefon girin. Örnek: 0532 123 45 67',
        },
        { status: 400 }
      )
    }
    if (phoneList.length > 3) {
      return NextResponse.json(
        { success: false, error: 'En fazla 3 telefon numarası kaydedilebilir.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const phoneValue = phoneList.map((p) => formatPhoneDisplay(p)).join('; ')

    const { error: updateError } = await admin
      .from('cariler')
      .update({ telefon: phoneValue || null })
      .eq('cari_kod', cariKod)
    if (updateError) throw updateError

    const { error: logError } = await admin.from('mail_gonderim_log').insert({
      mail_to: phoneList.join('; ') || '',
      subject: 'WhatsApp telefon güncellendi',
      body_preview: `${cari.firma_adi} için kullanıcı tarafından düzenlendi`,
      kaynak: HATIRLATMA_LOG_KAYNAK,
      ilgili_id: cariKod,
      ilgili_tip: WHATSAPP_PHONE_OVERRIDE_TIP,
      sent_at: new Date().toISOString(),
    })
    if (logError) throw logError

    return NextResponse.json({
      success: true,
      telefonlar: phoneList,
      display: phoneList.map((p) => formatPhoneDisplay(p)),
      message: phoneList.length ? 'Telefon numarası kaydedildi.' : 'Telefon numarası temizlendi.',
    })
  } catch (cause) {
    console.error('[hatirlatma-cari-telefon]', cause)
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'Telefon kaydedilemedi.') },
      { status: 500 }
    )
  }
}
