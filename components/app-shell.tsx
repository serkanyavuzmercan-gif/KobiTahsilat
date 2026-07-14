'use client'

import { usePathname } from 'next/navigation'
import { AuthActions } from './auth-actions'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const customerPage = pathname.startsWith('/mutabakat/itiraz/')
  const barePage = customerPage || pathname === '/login'

  if (barePage) {
    return <main className="min-h-screen bg-slate-50 px-4 py-6">{children}</main>
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
              KobiTahsilat
            </p>
            <h1 className="text-lg font-semibold text-slate-900">Tahsilat Takip</h1>
          </div>
          <nav className="flex gap-1 text-sm sm:gap-3">
            <a className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 sm:px-3" href="/">
              Özet
            </a>
            <a
              className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 sm:px-3"
              href="/cariler"
            >
              Cariler
            </a>
            <a
              className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 sm:px-3"
              href="/mutabakat"
            >
              Mutabakat
            </a>
            <a
              className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 sm:px-3"
              href="/mutabakat/ayarlar"
            >
              E-posta
            </a>
            <AuthActions />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
