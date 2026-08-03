import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { createRouteClient } from '@/lib/supabase/route'
import { girisKontrol, girisKaydet, istekIp } from '@/lib/giris-limit'

export const dynamic = 'force-dynamic'

/**
 * MFA KOD DOĞRULAMA — hem kurulum onayında hem her girişte kullanılır.
 * Başarılı olursa oturum aal1 → aal2'ye yükselir (çerezler burada güncellenir).
 *
 * 6 haneli kod kaba kuvvetle denenebileceği için giriş ile AYNI kilit uygulanır
 * (kullanıcı başına 15 dk'da 5 hata → 15 dk kilit).
 */
export async function POST(request: Request) {
  const ip = istekIp(request)
  let kimlik = ''
  try {
    const user = await requireAuthUser()
    kimlik = `mfa:${user.id}`

    const kilit = await girisKontrol(kimlik, ip)
    if (kilit.bloke) {
      const dk = Math.max(1, Math.ceil(kilit.kalanSaniye / 60))
      return NextResponse.json(
        { success: false, error: `Çok fazla hatalı kod. ${dk} dakika sonra tekrar deneyin.` },
        { status: 429 }
      )
    }

    const body = (await request.json()) as { code?: string; factorId?: string }
    const code = String(body.code || '').replace(/\D/g, '')
    if (code.length !== 6) {
      return NextResponse.json({ success: false, error: '6 haneli kodu girin.' }, { status: 400 })
    }

    const supabase = await createRouteClient()
    const { data: faktorler } = await supabase.auth.mfa.listFactors()
    const hepsi = faktorler?.all || []
    // Kurulum onayında henüz 'unverified' olan faktör kullanılır; girişte 'verified' olan.
    const faktor =
      (body.factorId && hepsi.find((f) => f.id === body.factorId)) ||
      hepsi.find((f) => f.status === 'verified') ||
      hepsi[0]

    if (!faktor) {
      return NextResponse.json(
        { success: false, error: 'Kayıtlı kimlik doğrulayıcı bulunamadı.' },
        { status: 400 }
      )
    }

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: faktor.id,
    })
    if (chErr || !challenge) throw new Error(chErr?.message || 'Doğrulama başlatılamadı.')

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: faktor.id,
      challengeId: challenge.id,
      code,
    })

    if (vErr) {
      await girisKaydet(kimlik, ip, false)
      return NextResponse.json({ success: false, error: 'Kod doğrulanamadı.' }, { status: 401 })
    }

    await girisKaydet(kimlik, ip, true)
    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error('[mfa-dogrula]', cause)
    if (kimlik) await girisKaydet(kimlik, ip, false)
    const message = toErrorMessage(cause, 'Doğrulama başarısız.')
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Oturum') ? 401 : 500 }
    )
  }
}
