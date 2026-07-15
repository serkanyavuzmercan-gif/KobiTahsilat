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
    request.nextUrl.pathname === '/api/mutabakat/itiraz'
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
