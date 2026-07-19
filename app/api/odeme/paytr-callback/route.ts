import { verifyCallbackHash, paytrYapili } from '@/lib/paytr'
import { markLinkFromCallback } from '@/lib/odeme-link'

export const dynamic = 'force-dynamic'

/**
 * PayTR ödeme bildirimi (webhook). PayTR:
 *  - gövdeyi `application/x-www-form-urlencoded` gönderir (JSON DEĞİL → formData),
 *  - başarı için tam olarak düz metin "OK" bekler (aksi halde saatlerce tekrar dener).
 * Hash FAIL-CLOSED doğrulanır: eşleşmezse ödeme işaretlenmez (sahte bildirim geçemez).
 * Karar (kullanıcı): şimdilik yalnız logla — Mikro'ya tahsilat işleme YOK.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const raw: Record<string, string> = {}
    for (const [k, v] of form.entries()) raw[k] = String(v)

    const merchantOid = raw.merchant_oid || ''
    const status = raw.status || ''
    const totalAmount = raw.total_amount || ''
    const hash = raw.hash || ''

    // Yapılandırma yoksa veya hash geçersizse: PayTR'yi tekrar denemekten kurtarmak için "OK"
    // döneriz ama HİÇBİR şeyi ödendi işaretlemeyiz (fail-closed).
    if (!paytrYapili() || !merchantOid || !verifyCallbackHash({ merchantOid, status, totalAmount, hash })) {
      if (paytrYapili()) console.error('[paytr-callback] hash/param doğrulanamadı', merchantOid)
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    const totalKurus = /^\d+$/.test(totalAmount) ? Number(totalAmount) : null
    const sonuc = await markLinkFromCallback({
      merchantOid,
      basarili: status === 'success',
      totalAmountKurus: totalKurus,
      raw,
    })
    if (!sonuc.bulundu) console.error('[paytr-callback] merchant_oid eşleşmedi', merchantOid)

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (cause) {
    console.error('[paytr-callback]', cause)
    // Hata durumunda dahi PayTR'ye 200/OK dönmek genelde tekrar fırtınasını önler; sorunu logdan çözeriz.
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
}
