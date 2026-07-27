import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMutabakatCariler } from '@/lib/mutabakat-data'
import { collectMutabakatCandidates } from '@/lib/automation/eligibility'
import { loadAutomationSettings } from '@/lib/automation/settings'
import { MAIL_LOG_KAYNAK } from '@/lib/mutabakat-log'

export const dynamic = 'force-dynamic'

/**
 * TEK SEFERLİK DÜZELTME: 2026-07-17 çalıştırmasında gönderilen ama (mail_from kolon hatası
 * yüzünden) loglanmayan mutabakat maillerini geriye dönük 'mutabakat' log satırı olarak yazar.
 * İdempotent: zaten 'mutabakat' logu olan cari atlanır. 120.01.4350 gönderilemediği için hariç.
 */
const RUN_SENT_AT = '2026-07-17T14:55:04.000Z'
const HARIC = new Set(['120.01.4350'])

export async function GET() {
  try {
    const user = await requireAuthUser()
    const settings = await loadAutomationSettings(user.id)
    const cariler = await loadMutabakatCariler()
    const adaylar = collectMutabakatCandidates(cariler, settings.mutabakat.taban_bakiye)
    // Gönderilmiş kabul edilenler: engeli olmayan (e-postası olan) mutabakat adayları, hariç tutulan dışında.
    const gonderilmis = adaylar.filter((a) => !a.engel && a.alici && !HARIC.has(a.cari_kod))

    const admin = createAdminClient()
    const kodlar = gonderilmis.map((a) => a.cari_kod)

    // İdempotluk: zaten mutabakat logu olanları çıkar.
    const { data: mevcut } = await admin
      .from('mail_gonderim_log')
      .select('ilgili_id')
      .eq('ilgili_tip', 'mutabakat')
      .in('ilgili_id', kodlar)
    const zaten = new Set((mevcut || []).map((r) => String(r.ilgili_id)))

    const yazilacak = gonderilmis.filter((a) => !zaten.has(a.cari_kod))
    if (yazilacak.length) {
      const rows = yazilacak.map((a) => ({
        mail_to: a.alici as string,
        subject: 'Cari hesap bakiye mutabakatı (geriye dönük kayıt)',
        body_preview: `${a.firma_adi} mutabakatı (otomatik, 17.07 çalıştırması) gönderildi`,
        kaynak: MAIL_LOG_KAYNAK,
        ilgili_id: a.cari_kod,
        ilgili_tip: 'mutabakat',
        sent_at: RUN_SENT_AT,
      }))
      const { error } = await admin.from('mail_gonderim_log').insert(rows)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      aday: adaylar.length,
      gonderilmis_kabul: gonderilmis.length,
      zaten_loglu: zaten.size,
      eklenen: yazilacak.length,
      mesaj: `${yazilacak.length} mutabakat gönderimi geriye dönük loglandı.`,
    })
  } catch (cause) {
    console.error('[backfill-mutabakat-log]', cause)
    const message = toErrorMessage(cause, 'Backfill başarısız.')
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Oturum') ? 401 : 500 }
    )
  }
}
