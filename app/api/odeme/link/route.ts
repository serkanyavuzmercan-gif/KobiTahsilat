import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { getCari } from '@/lib/data'
import { paytrYapili } from '@/lib/paytr'
import { getOrCreateOdemeLinkForCari } from '@/lib/odeme-link'

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

    // Ortak yardımcı: cari başına tek aktif link + "aynı tutar yakında ödendi" çift-tahsilat engeli.
    const link = await getOrCreateOdemeLinkForCari({
      cariKod,
      firmaAdi: cari.firma_adi,
      cariEmail: cari.email_adresleri[0] || null,
      amountKurus,
      userId: user.id,
    })
    if (!link) return NextResponse.json({ success: false, error: 'Link oluşturulamadı.' }, { status: 502 })

    return NextResponse.json({
      success: true,
      kisa_link: link.kisaLink,
      paytr_url: link.paytrUrl,
      qr: link.qr,
      tutar: tutarTL,
      firma: cari.firma_adi,
    })
  } catch (cause) {
    console.error('[odeme-link]', cause)
    const message = toErrorMessage(cause, 'Link oluşturulamadı.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}
