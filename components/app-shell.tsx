'use client'

import { usePathname } from 'next/navigation'
import { AppFooter } from './app-footer'
import { AppNav } from './app-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Login sayfası kendi tam ekran (ss ile aynı) tasarımını yönetir; sarmalama yok.
  if (pathname === '/login') {
    return <>{children}</>
  }

  const customerPage =
    pathname.startsWith('/mutabakat/itiraz/') || pathname.startsWith('/mutabakat/onay/')

  if (customerPage) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <main className="flex-1 px-4 py-6">{children}</main>
        <AppFooter minimal />
      </div>
    )
  }

  // Tüm uygulama TAM GENİŞLİK (kullanıcı kararı): yan boşluklar yok, sayfa ferah; geniş
  // tablolar rahatça sığar. Yalnız kenar payı bırakılır (px).
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main className="w-full flex-1 px-4 py-6 lg:px-6">{children}</main>
      <AppFooter />
    </div>
  )
}
