import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const expectedPassword = process.env.APP_PASSWORD

  // Parola tanımlı değilse uygulamayı yanlışlıkla açık yayınlama.
  if (!expectedPassword) {
    return new NextResponse('Uygulama erişimi yapılandırılmadı.', { status: 503 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Basic ')) {
    try {
      const credentials = atob(authorization.slice(6))
      const separator = credentials.indexOf(':')
      const username = credentials.slice(0, separator)
      const password = credentials.slice(separator + 1)

      if (username === 'admin' && password === expectedPassword) {
        return NextResponse.next()
      }
    } catch {
      // Geçersiz Basic Auth başlığı aşağıdaki 401 yanıtına düşer.
    }
  }

  return new NextResponse('Giriş gerekli.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="KobiTahsilat", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
