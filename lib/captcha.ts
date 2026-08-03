import 'server-only'

/**
 * Login CAPTCHA doğrulaması — hCaptcha VEYA Cloudflare Turnstile.
 *
 * Hangisi yapılandırıldıysa o kullanılır (hCaptcha önceliklidir):
 *   hCaptcha  : NEXT_PUBLIC_HCAPTCHA_SITE_KEY  + HCAPTCHA_SECRET_KEY
 *               → görsel bulmaca ("otobüsleri seç") gösterebilir; zorluk hCaptcha panelinden ayarlanır.
 *   Turnstile : NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY
 *               → tasarım gereği görsel bulmaca YOKTUR (görünmez/otomatik doğrulama).
 *
 * Hiçbiri yoksa CAPTCHA devre dışıdır (giriş normal çalışır) — acil kill-switch olarak da kullanılır.
 */

const HCAPTCHA_VERIFY = 'https://api.hcaptcha.com/siteverify'
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type CaptchaSaglayici = 'hcaptcha' | 'turnstile' | null

export function captchaSaglayici(): CaptchaSaglayici {
  if (process.env.HCAPTCHA_SECRET_KEY) return 'hcaptcha'
  if (process.env.TURNSTILE_SECRET_KEY) return 'turnstile'
  return null
}

/** Sunucu tarafında doğrulama yapılacak mı? */
export function captchaZorunlu(): boolean {
  return captchaSaglayici() !== null
}

export async function captchaDogrula(token: string, ip?: string): Promise<boolean> {
  const saglayici = captchaSaglayici()
  if (!saglayici) return true // yapılandırılmadıysa engelleme
  if (!token) return false

  const secret =
    saglayici === 'hcaptcha' ? process.env.HCAPTCHA_SECRET_KEY! : process.env.TURNSTILE_SECRET_KEY!
  const url = saglayici === 'hcaptcha' ? HCAPTCHA_VERIFY : TURNSTILE_VERIFY

  try {
    const form = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'bilinmeyen') form.set('remoteip', ip)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const json = (await res.json()) as { success?: boolean }
    return json.success === true
  } catch {
    // Sağlayıcıya ulaşılamıyorsa girişi tamamen kilitleme (kendimizi dışarıda bırakmayalım);
    // brute-force kilidi zaten ayrıca çalışıyor.
    return true
  }
}
