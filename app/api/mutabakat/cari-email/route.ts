import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { parseEmails } from '@/lib/mutabakat-data'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cariKod?: string; emails?: string }
    const cariKod = String(body.cariKod || '').trim()
    const cari = await getCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }

    const raw = String(body.emails || '').trim()
    const emailList = parseEmails(raw)
    if (raw && !emailList.length) {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir e-posta adresi girin.' },
        { status: 400 }
      )
    }
    if (emailList.length > 10) {
      return NextResponse.json(
        { success: false, error: 'En fazla 10 e-posta adresi kaydedilebilir.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const emailValue = emailList.join('; ')
    const { error: updateError } = await admin
      .from('cariler')
      .update({ email: emailValue || null })
      .eq('cari_kod', cariKod)
    if (updateError) throw updateError

    // Ayrı mutabakat tablosu devreye alınana kadar merkezi mail logu bir append-only override
    // geçmişi olarak kullanılır. ilgili_tip bu satırın gerçek gönderim olmadığını açıkça ayırır.
    const { error: logError } = await admin.from('mail_gonderim_log').insert({
      mail_to: emailValue,
      subject: 'Mutabakat e-posta adresi güncellendi',
      body_preview: `${cari.firma_adi} için kullanıcı tarafından düzenlendi`,
      kaynak: 'teklif_talep_musteri',
      ilgili_id: cariKod,
      ilgili_tip: 'mutabakat_email_override',
    })
    if (logError) throw logError

    return NextResponse.json({
      success: true,
      emails: emailList,
      message: emailList.length ? 'E-posta adresi kaydedildi.' : 'E-posta adresi temizlendi.',
    })
  } catch (cause) {
    console.error('[mutabakat-cari-email]', cause instanceof Error ? cause.message : cause)
    return NextResponse.json(
      { success: false, error: 'E-posta adresi kaydedilemedi.' },
      { status: 500 }
    )
  }
}
