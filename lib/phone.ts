/** Türkiye telefon normalizasyonu ve kullanıcı dostu gösterim. */

const MOBILE_RE = /^\+905\d{9}$/
const TR_E164_RE = /^\+90\d{10}$/

/** Kullanıcı girdisini E.164 (+90…) formatına çevirir. Geçersizse null. */
export function normalizePhone(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null

  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  digits = digits.replace(/\D/g, '')

  if (!digits) return null

  // 0 532 … veya 90 532 … veya 532 …
  if (digits.startsWith('90') && digits.length === 12) {
    return `+${digits}`
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+90${digits.slice(1)}`
  }
  if (digits.length === 10 && digits.startsWith('5')) {
    return `+90${digits}`
  }
  if (digits.length === 10 && /^[2-4]/.test(digits)) {
    // Sabit hat (alan kodu + numara)
    return `+90${digits}`
  }

  return null
}

export function isValidTurkeyPhone(e164: string | null | undefined): boolean {
  return Boolean(e164 && TR_E164_RE.test(e164))
}

export function isMobileTurkey(e164: string | null | undefined): boolean {
  return Boolean(e164 && MOBILE_RE.test(e164))
}

/** Ekranda gösterim: 0532 123 45 67 veya (0258) 251 40 60 */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164 || !TR_E164_RE.test(e164)) return '—'
  const national = `0${e164.slice(3)}`
  if (national.startsWith('05')) {
    const d = national.slice(1)
    return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`
  }
  const area = national.slice(1, 4)
  const rest = national.slice(4)
  if (rest.length === 7) {
    return `(${area}) ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`
  }
  return national
}

/** WhatsApp API için: 905321234567 */
export function formatPhoneWhatsApp(e164: string): string {
  return e164.replace(/\D/g, '')
}

export function parsePhones(value: unknown): string[] {
  const items = String(value || '')
    .split(/[;,\n/|]+/)
    .map((item) => normalizePhone(item))
    .filter((item): item is string => Boolean(item))
  return [...new Set(items)]
}

export const PHONE_INPUT_PLACEHOLDER = '0532 123 45 67'
export const PHONE_INPUT_HINT =
  'Başında 0 veya +90 ile girebilirsiniz. Örnek: 0532 123 45 67 · Birden fazla numara için noktalı virgül kullanın.'
