import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { parseEmails } from '@/lib/mutabakat-data'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cariKod?: string; email?: string }
    const cariKod = String(body.cariKod || '').trim()
    const email = parseEmails(body.email)[0]
    const cari = await getCari(cariKod)
    if (!cari || !email) {
      return NextResponse.json({ success: false, error: 'Cari veya e-posta geçersiz.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('mail_gonderim_log').insert({
      mail_to: email,
      subject: 'Mutabakat e-posta adayı reddedildi',
      body_preview: `${cari.firma_adi} için kullanıcı tarafından gizlendi`,
      kaynak: 'teklif_talep_musteri',
      ilgili_id: cariKod,
      ilgili_tip: 'mutabakat_email_aday_reddet',
    })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error('[mutabakat-email-aday]', cause instanceof Error ? cause.message : cause)
    return NextResponse.json(
      { success: false, error: 'E-posta adayı gizlenemedi.' },
      { status: 500 }
    )
  }
}
