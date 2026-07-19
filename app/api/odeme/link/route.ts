import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { getCari } from '@/lib/data'
import { getPaytrConfig, paytrYapili, createPaymentLink } from '@/lib/paytr'
import { generateLinkToken, insertOdemeLink, shortLinkUrl } from '@/lib/odeme-link'

export const dynamic = 'force-dynamic'

/**
 * Bir cari için PayTR ödeme linki üretir (panel "Ödeme Al" sekmesi + ileride otomasyon).
 * Tutar: verilmezse gecikmiş bakiye (kuruş). editable=true → müşteri hosted sayfada değiştirebilir.
 * PayTR yapılandırılmadıysa 200 + { yapili:false } döner (UI dostça uyarı gösterir, çökmez).
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()

    if (!paytrYapili()) {
      return NextResponse.json({
        success: false,
        yapili: false,
        error: 'PayTR henüz bağlı değil (merchant anahtarları bekleniyor).',
      })
    }

    const body = (await request.json()) as { cariKod?: string; tutar?: number; editable?: boolean }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) return NextResponse.json({ success: false, error: 'cariKod gerekli.' }, { status: 400 })

    const cari = await getCari(cariKod)
    if (!cari) return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })

    // Tutar (TL) → kuruş. Varsayılan gecikmiş bakiye; verilmişse onu kullan. Math.round ile kuruş.
    const tutarTL = typeof body.tutar === 'number' && body.tutar > 0 ? body.tutar : cari.gecikmis_bakiye
    const amountKurus = Math.round(tutarTL * 100)
    if (!Number.isFinite(amountKurus) || amountKurus <= 0) {
      return NextResponse.json({ success: false, error: 'Geçerli bir tutar girin.' }, { status: 400 })
    }

    const editable = body.editable !== false
    const token = generateLinkToken()
    // collection tipi hash'i için email ZORUNLU. Cari e-postası yoksa şirket fallback'i (PayTR bildirimi
    // buraya gider; müşterinin gerçek maili değilse bile link çalışır).
    const cariEmail = cari.email_adresleri[0] || null
    const email =
      cariEmail || process.env.PAYTR_FALLBACK_EMAIL || process.env.GMAIL_SENDER || 'finans@hidroteknik.com.tr'

    const link = await createPaymentLink({
      name: `${cari.firma_adi} — cari hesap ödemesi`,
      amountKurus,
      email,
      callbackId: token,
    })
    if (!link.ok) return NextResponse.json({ success: false, error: link.error }, { status: 502 })

    await insertOdemeLink({
      token,
      paytrLinkId: link.id,
      cariKod,
      firmaAdi: cari.firma_adi,
      tutarKurus: amountKurus,
      editable,
      email: cariEmail,
      paytrUrl: link.url,
      testMode: getPaytrConfig()?.testMode ?? false,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      kisa_link: shortLinkUrl(token),
      paytr_url: link.url,
      tutar: tutarTL,
      firma: cari.firma_adi,
    })
  } catch (cause) {
    console.error('[odeme-link]', cause)
    const message = toErrorMessage(cause, 'Link oluşturulamadı.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}
