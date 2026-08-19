import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { baskiDurumu } from '@/lib/tahsilat-baski'

export const dynamic = 'force-dynamic'

/**
 * Bir carinin son günlerdeki tahsilat baskısı (kaç evrak gitti, ödeme geldi mi).
 * Gönderim penceresi AÇILIRKEN çağrılır: kullanıcı "gönder"e basmadan ÖNCE toplamı görsün.
 *
 * Neden ayrı uç? "Her ikisi" (WhatsApp + e-posta) tek eylemde iki gönderim yapar; kapı her iki
 * uçta ayrı ayrı çalışsaydı ilk kanal log yazdığı için İKİNCİSİ kendi kendini bloklardı.
 * Onay bir kez, önden alınır.
 */
export async function GET(request: Request) {
  try {
    await requireAuthUser()
    const cariKod = new URL(request.url).searchParams.get('cariKod')?.trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
    }
    return NextResponse.json({ success: true, baski: await baskiDurumu(cariKod) })
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'Baskı durumu okunamadı.') },
      { status: 500 }
    )
  }
}
