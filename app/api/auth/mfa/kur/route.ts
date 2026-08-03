import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { createRouteClient } from '@/lib/supabase/route'

export const dynamic = 'force-dynamic'

/**
 * MFA (TOTP) KURULUMU — yeni bir doğrulayıcı faktörü oluşturur.
 * Dönen QR kodu Google Authenticator / Microsoft Authenticator ile okutulur; ardından
 * /api/auth/mfa/dogrula'ya 6 haneli kod gönderilerek faktör doğrulanır (verified olur).
 */
export async function POST() {
  try {
    await requireAuthUser()
    const supabase = await createRouteClient()

    // Yarım kalmış (unverified) faktörleri temizle — aksi halde "zaten kayıtlı" hatası alınır.
    const { data: mevcut } = await supabase.auth.mfa.listFactors()
    const yarim = (mevcut?.all || []).filter((f) => f.status !== 'verified')
    for (const f of yarim) await supabase.auth.mfa.unenroll({ factorId: f.id })

    const dogrulanmis = (mevcut?.all || []).filter((f) => f.status === 'verified')
    if (dogrulanmis.length > 0) {
      return NextResponse.json({
        success: false,
        zatenKurulu: true,
        error: 'Bu hesapta zaten doğrulanmış bir kimlik doğrulayıcı var.',
      })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Finans ${new Date().toISOString().slice(0, 10)}`,
    })
    if (error || !data) throw new Error(error?.message || 'Kurulum başlatılamadı.')

    return NextResponse.json({
      success: true,
      factorId: data.id,
      qr: data.totp.qr_code, // data:image/svg+xml;... (doğrudan <img src>)
      secret: data.totp.secret, // elle girmek isteyenler için
    })
  } catch (cause) {
    console.error('[mfa-kur]', cause)
    const message = toErrorMessage(cause, 'Kurulum başlatılamadı.')
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Oturum') ? 401 : 500 }
    )
  }
}
