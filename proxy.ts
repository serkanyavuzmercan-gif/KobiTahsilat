import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Auth ayarı yoksa hassas bakiyeleri yanlışlıkla açık yayınlama.
  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse('Kimlik doğrulama yapılandırılmadı.', { status: 503 })
  }

  // Müşteri yanıt sayfaları yalnız HMAC imzalı, süreli token ile çalışır.
  const isPublicMutabakatResponse =
    request.nextUrl.pathname.startsWith('/mutabakat/itiraz/') ||
    request.nextUrl.pathname.startsWith('/mutabakat/onay/') ||
    request.nextUrl.pathname === '/api/mutabakat/itiraz' ||
    request.nextUrl.pathname === '/api/mutabakat/onay' ||
    request.nextUrl.pathname === '/api/odeme-talebi/pdf' ||
    request.nextUrl.pathname === '/api/enrich/telefon-mikro' ||
    // PayTR: müşteriye giden kısa ödeme linki (/o/<token>) + PayTR bildirim webhook'u.
    request.nextUrl.pathname.startsWith('/o/') ||
    request.nextUrl.pathname === '/api/odeme/paytr-callback' ||
    // Kısa döküm linki (/d/<code>) — WhatsApp'ta müşteriye giden PDF döküm.
    request.nextUrl.pathname.startsWith('/d/') ||
    // Sunucu-sunucu (secret'lı) WhatsApp bot bağlam ucu — tawkto çağırır.
    request.nextUrl.pathname === '/api/tahsilat/wa-baglam' ||
    // Giriş ucu: oturum AÇILMADAN çağrılır (auth kapısına takılırsa login imkânsız olur).
    request.nextUrl.pathname === '/api/auth/giris'
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron/')
  const isWebhookRoute = request.nextUrl.pathname.startsWith('/api/webhooks/')
  if (isPublicMutabakatResponse || isCronRoute || isWebhookRoute) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            maxAge: options?.maxAge ?? AUTH_COOKIE_MAX_AGE,
          })
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (request.nextUrl.pathname === '/login') {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return redirectWithCookies(url, response)
    }
    return response
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return redirectWithCookies(url, response)
  }

  // MFA ZORUNLULUĞU
  //  (a) Faktörü VAR ama oturum kodla yükseltilmemişse (aal1) → /mfa (kod ekranı).
  //      Bu kontrol OLMAZSA kullanıcı kodu girmeden gezinebilirdi (MFA baypas edilirdi).
  //  (b) MFA_ZORUNLU=true iken faktörü HİÇ YOKSA → /guvenlik (kurulum zorunlu).
  //      Kapalıyken faktörü olmayan personel etkilenmez (kademeli geçiş).
  const mfaSayfasi = request.nextUrl.pathname === '/mfa'
  const guvenlikSayfasi = request.nextUrl.pathname === '/guvenlik'
  const mfaApi = request.nextUrl.pathname.startsWith('/api/auth/mfa/')
  if (!mfaSayfasi && !guvenlikSayfasi && !mfaApi) {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const url = request.nextUrl.clone()
        url.pathname = '/mfa'
        url.search = ''
        return redirectWithCookies(url, response)
      }
      // Faktör yok (nextLevel=aal1) ve zorunluluk açık → kuruluma yönlendir.
      if (process.env.MFA_ZORUNLU === 'true' && aal?.nextLevel === 'aal1') {
        const url = request.nextUrl.clone()
        url.pathname = '/guvenlik'
        url.search = ''
        return redirectWithCookies(url, response)
      }
    } catch {
      // AAL okunamazsa girişi engelleme (kendimizi dışarıda bırakmayalım).
    }
  }

  return response
}

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url)
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
