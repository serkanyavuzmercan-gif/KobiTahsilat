import 'server-only'
import crypto from 'crypto'

/**
 * PayTR "Ödeme Linki API" entegrasyonu (B2B tahsilat).
 *
 * ⚠️ PROTOKOL DOĞRULAMASI (YARIN — creds gelince):
 * Aşağıdaki `LINK_CREATE_URL`, link-create `paytr_token` hash string'i ve callback hash string'i
 * PayTR'nin GÜNCEL "Ödeme Linki API" dokümanına göre BİREBİR doğrulanmalıdır. iFrame API'sine
 * benzediği VARSAYILMAMALIDIR (alan sırası / key-salt rolü farklı olabilir). Doğruladıktan sonra
 * `verifyCallbackHash` fail-closed kaldığı için sahte "ödendi" bildirimi zaten geçemez; ama link
 * oluşturma hash'i yanlışsa PayTR isteği reddeder (zararsız, sadece link üretilmez).
 */

const LINK_CREATE_URL = 'https://www.paytr.com/odeme/api/link/create'

export type PaytrConfig = {
  merchantId: string
  merchantKey: string
  merchantSalt: string
  testMode: boolean
}

/** Env'den config; eksikse null (paytrYapili=false → tüm akış güvenli no-op). */
export function getPaytrConfig(): PaytrConfig | null {
  const merchantId = process.env.PAYTR_MERCHANT_ID
  const merchantKey = process.env.PAYTR_MERCHANT_KEY
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT
  if (!merchantId || !merchantKey || !merchantSalt) return null
  return {
    merchantId,
    merchantKey,
    merchantSalt,
    testMode: process.env.PAYTR_TEST_MODE === 'true' || process.env.PAYTR_TEST_MODE === '1',
  }
}

export function paytrYapili(): boolean {
  return getPaytrConfig() !== null
}

function base64Hmac(data: string, key: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('base64')
}

export type CreatePaymentLinkInput = {
  merchantOid: string
  name: string
  amountKurus: number
  email?: string | null
  /** Müşteri hosted sayfada tutarı değiştirebilsin mi (serbest tutar). */
  editable: boolean
  /** PayTR bildirimi geldiğinde bize dönecek referans (kendi token'ımız). */
  callbackId: string
}

export type CreatePaymentLinkResult = {
  ok: true
  id: string
  url: string
} | {
  ok: false
  error: string
}

/**
 * PayTR'de ödeme linki oluşturur. Config yoksa çağrılmamalı (paytrYapili ile önce kontrol et).
 * ⚠️ Alan seti ve hash string'i yarın doküman ile kesinleştirilecek.
 */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
  const cfg = getPaytrConfig()
  if (!cfg) return { ok: false, error: 'PayTR yapılandırılmadı.' }

  const price = String(Math.round(input.amountKurus))
  const linkType = input.editable ? 'collection' : 'product'
  const maxInstallment = '0'
  const lang = 'tr'

  // ⚠️ YARIN DOĞRULA: PayTR Ödeme Linki API'sinin link-create hash string alan SIRASI.
  const hashStr = `${cfg.merchantId}${input.name}${price}TL${maxInstallment}${linkType}${lang}${cfg.merchantSalt}`
  const paytrToken = base64Hmac(hashStr, cfg.merchantKey)

  const form = new URLSearchParams({
    merchant_id: cfg.merchantId,
    name: input.name,
    price,
    currency: 'TL',
    max_installment: maxInstallment,
    link_type: linkType,
    lang,
    get_qr: '1',
    callback_id: input.callbackId,
    merchant_oid: input.merchantOid,
    test_mode: cfg.testMode ? '1' : '0',
    debug_on: cfg.testMode ? '1' : '0',
    paytr_token: paytrToken,
  })
  if (input.email) form.set('email', input.email)

  try {
    const res = await fetch(LINK_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const json = (await res.json()) as { status?: string; id?: string; link?: string; reason?: string; err_msg?: string }
    if (json.status !== 'success' || !json.id) {
      return { ok: false, error: json.reason || json.err_msg || 'PayTR link oluşturulamadı.' }
    }
    // PayTR ödeme URL'si: dönen id ile. (Bazı sürümlerde `link` alanı da döner.)
    const url = json.link || `https://www.paytr.com/link/${json.id}`
    return { ok: true, id: json.id, url }
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'PayTR isteği başarısız.' }
  }
}

/**
 * PayTR bildirim (callback) hash doğrulaması — FAIL-CLOSED.
 * Hash eşleşmezse false → çağıran ASLA ödemeyi "ödendi" işaretlemez. Sahte bildirim geçemez.
 * ⚠️ YARIN DOĞRULA: callback hash string'inin alan sırası (merchant_oid+salt+status+total_amount).
 */
export function verifyCallbackHash(params: {
  merchantOid: string
  status: string
  totalAmount: string
  hash: string
}): boolean {
  const cfg = getPaytrConfig()
  if (!cfg) return false
  const hashStr = `${params.merchantOid}${cfg.merchantSalt}${params.status}${params.totalAmount}`
  const expected = base64Hmac(hashStr, cfg.merchantKey)
  const a = Buffer.from(expected)
  const b = Buffer.from(params.hash || '')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
