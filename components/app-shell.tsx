'use client'

import { usePathname } from 'next/navigation'
import { AppFooter } from './app-footer'
import { AppNav } from './app-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const customerPage = pathname.startsWith('/mutabakat/itiraz/')
  const barePage = customerPage || pathname === '/login'

  if (barePage) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <main className="flex-1 px-4 py-6">{children}</main>
        <AppFooter minimal />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <AppFooter />
    </div>
  )
}
