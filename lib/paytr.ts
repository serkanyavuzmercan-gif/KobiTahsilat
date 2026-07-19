import 'server-only'
import crypto from 'crypto'

/**
 * PayTR "Ödeme Linki API" entegrasyonu (B2B tahsilat).
 *
 * Protokol dev.paytr.com/link-api dokümanıyla DOĞRULANDI (2026-07):
 *   - create endpoint + collection hash (name+price+currency+max_installment+link_type+lang+email+salt)
 *   - callback hash (merchant_oid+salt+status+total_amount) → verifyCallbackHash fail-closed.
 *   - price KURUŞ; merchant_oid create'te gönderilmez (PayTR üretir), eşleştirme callback_id ile.
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
  name: string
  amountKurus: number
  /** collection tipinde ZORUNLU (hash'e girer); yoksa şirket fallback'i verilmeli. */
  email: string
  /** PayTR bildirimi geldiğinde bize geri dönecek eşleştirme referansımız (kendi token'ımız). */
  callbackId: string
}

export type CreatePaymentLinkResult = {
  ok: true
  id: string
  url: string
  qr?: string | null
} | {
  ok: false
  error: string
}

/**
 * PayTR'de "collection" (tahsilat) tipi ödeme linki oluşturur. Config yoksa çağrılmamalı.
 * Doküman (dev.paytr.com/link-api/link-api-create) ile doğrulanmış:
 *   collection hash = name+price+currency+max_installment+link_type+lang+email+merchant_salt
 *   paytr_token = base64(HMAC-SHA256(hashStr, merchant_key)); price KURUŞ; merchant_oid create'te YOK
 *   (PayTR ödeme anında üretir). Eşleştirme callback_id ile.
 */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
  const cfg = getPaytrConfig()
  if (!cfg) return { ok: false, error: 'PayTR yapılandırılmadı.' }

  const price = String(Math.round(input.amountKurus))
  const currency = 'TL'
  // PayTR Link API: max_installment '0' KABUL EDİLMEZ (canlı test) → '1' (tek çekim tabanı).
  const maxInstallment = '1'
  const linkType = 'collection'
  const lang = 'tr'
  const email = input.email

  // collection hash: name+price+currency+max_installment+link_type+lang+email + merchant_salt.
  // (callback_link ve callback_id hash'e GİRMEZ — canlı testte doğrulandı.)
  const required = `${input.name}${price}${currency}${maxInstallment}${linkType}${lang}${email}`
  const paytrToken = base64Hmac(`${required}${cfg.merchantSalt}`, cfg.merchantKey)

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr').replace(/\/$/, '')
  const form = new URLSearchParams({
    merchant_id: cfg.merchantId,
    name: input.name,
    price,
    currency,
    max_installment: maxInstallment,
    link_type: linkType,
    lang,
    email,
    get_qr: '1',
    callback_id: input.callbackId,
    callback_link: `${base}/api/odeme/paytr-callback`, // ZORUNLU (canlı testte doğrulandı)
    debug_on: cfg.testMode ? '1' : '0',
    paytr_token: paytrToken,
  })

  try {
    const res = await fetch(LINK_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const json = (await res.json()) as {
      status?: string
      id?: string
      link?: string
      base64_qr?: string
      reason?: string
      err_msg?: string
    }
    if (json.status !== 'success' || !json.id) {
      return { ok: false, error: json.reason || json.err_msg || 'PayTR link oluşturulamadı.' }
    }
    const url = json.link || `https://www.paytr.com/link/${json.id}`
    return { ok: true, id: json.id, url, qr: json.base64_qr || null }
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
