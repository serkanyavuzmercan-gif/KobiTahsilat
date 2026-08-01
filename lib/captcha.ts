import 'server-only'

/**
 * Cloudflare Turnstile doğrulaması (login botlarına karşı).
 * Env: NEXT_PUBLIC_TURNSTILE_SITE_KEY (widget) + TURNSTILE_SECRET_KEY (sunucu doğrulaması).
 * Anahtarlar yoksa CAPTCHA devre dışıdır (giriş normal çalışır) — kademeli devreye alınabilsin diye.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Sunucu tarafında doğrulama yapılacak mı? (secret tanımlıysa evet) */
export function captchaZorunlu(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function captchaDogrula(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // yapılandırılmadıysa engelleme
  if (!token) return false

  try {
    const form = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'bilinmeyen') form.set('remoteip', ip)

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const json = (await res.json()) as { success?: boolean }
    return json.success === true
  } catch {
    // Cloudflare'e ulaşılamıyorsa girişi tamamen kilitleme (kendi kendimizi dışarıda bırakmayalım);
    // brute-force kilidi zaten ayrıca çalışıyor.
    return true
  }
}
