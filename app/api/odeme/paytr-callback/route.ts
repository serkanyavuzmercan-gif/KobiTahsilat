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
    const callbackId = raw.callback_id || ''
    const status = raw.status || ''
    const totalAmount = raw.total_amount || ''
    const hash = raw.hash || ''

    // Yapılandırma yoksa veya hash geçersizse: PayTR'yi tekrar denemekten kurtarmak için "OK"
    // döneriz ama HİÇBİR şeyi ödendi işaretlemeyiz (fail-closed).
    // Link API hash: callback_id + merchant_oid + merchant_salt + status + total_amount.
    if (!paytrYapili() || !merchantOid || !verifyCallbackHash({ callbackId, merchantOid, status, totalAmount, hash })) {
      if (paytrYapili())
        console.error('[paytr-callback] hash/param doğrulanamadı', JSON.stringify({ merchantOid, callbackId, status, totalAmount }))
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    const totalKurus = /^\d+$/.test(totalAmount) ? Number(totalAmount) : null
    // markLinkFromCallback DB hatasında FIRLATIR → aşağıdaki catch 500 döner → PayTR tekrar dener
    // (doğrulanmış ödeme sessizce kaybolmaz). Eşleşmeyen callback_id 500 değil, sadece loglanır.
    const sonuc = await markLinkFromCallback({
      callbackId,
      merchantOid,
      basarili: status === 'success',
      totalAmountKurus: totalKurus,
      raw,
    })
    if (!sonuc.bulundu) console.error('[paytr-callback] callback_id eşleşmedi', callbackId, merchantOid)

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (cause) {
    // Doğrulanmış ama İŞLENEMEYEN callback: OK DÖNME → 500 ver ki PayTR tekrar denesin.
    console.error('[paytr-callback] işleme hatası', cause)
    return new Response('Gecici hata', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}
