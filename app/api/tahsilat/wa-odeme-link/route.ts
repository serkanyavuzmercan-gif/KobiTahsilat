import { NextResponse } from 'next/server'
import { getOrCreateWaOdemeLink, WA_ODEME_VARSAYILAN_KURUS } from '@/lib/odeme-link'
import { paytrYapili } from '@/lib/paytr'

export const dynamic = 'force-dynamic'

/**
 * SUNUCU-SUNUCU (secret korumalı): WhatsApp botunun (tawkto) çağırdığı ödeme linki ucu.
 *
 * Müşteri WhatsApp'ta ödeme yapmak isteyince bot bu ucu çağırır, dönen kısa linki (/o/<token>)
 * sohbete yapıştırır. Kart bilgisi ne bota ne bize değer — ödeme PayTR hosted sayfasında yapılır.
 *
 * Tutar: varsayılan 1 TL; müşteri PayTR sayfasında ödemek istediği tutarı girer. Fiilen tahsil
 * edilen tutar callback'te `total_amount` ile gelir ve `odeme_linkleri.odenen_kurus`'a yazılır.
 *
 * Yetki: `wa-baglam` ile AYNI secret (aynı güven sınırı — tawkto sunucusu). service_role bu
 * projede kalır; tawkto'ya asla verilmez.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret') || request.headers.get('x-wa-baglam-secret') || ''
    const beklenen = process.env.WA_BAGLAM_SECRET || ''
    if (!beklenen || secret !== beklenen) {
      return NextResponse.json({ ok: false, error: 'yetkisiz' }, { status: 401 })
    }

    if (!paytrYapili()) {
      return NextResponse.json({ ok: false, error: 'PayTR yapılandırılmadı' }, { status: 200 })
    }

    const body = (await request.json().catch(() => ({}))) as { tel?: string; tutar?: number }
    const tel = String(body.tel || '').trim()
    if (!tel) return NextResponse.json({ ok: false, error: 'tel gerekli' }, { status: 400 })

    // tutar TL cinsinden opsiyoneldir; verilmezse 1 TL (müşteri sayfada kendi tutarını girer).
    const amountKurus =
      typeof body.tutar === 'number' && body.tutar > 0
        ? Math.round(body.tutar * 100)
        : WA_ODEME_VARSAYILAN_KURUS

    const link = await getOrCreateWaOdemeLink({ telefon: tel, amountKurus })
    if (!link) return NextResponse.json({ ok: false, error: 'link üretilemedi' }, { status: 200 })

    return NextResponse.json({ ok: true, link: link.kisaLink })
  } catch (cause) {
    console.error('[wa-odeme-link route]', cause)
    return NextResponse.json({ ok: false, error: 'hata' }, { status: 200 })
  }
}
