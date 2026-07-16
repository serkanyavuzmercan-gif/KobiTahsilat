/** Basit e-posta doğrulama + normalizasyon (istemci ve sunucu ortak). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Geçerli e-posta ise küçük harfe indirir, değilse null. */
export function normalizeEmail(input: unknown): string | null {
  const raw = String(input || '').trim().toLowerCase()
  return raw && EMAIL_RE.test(raw) ? raw : null
}

export function isValidEmail(input: unknown): boolean {
  return normalizeEmail(input) != null
}
