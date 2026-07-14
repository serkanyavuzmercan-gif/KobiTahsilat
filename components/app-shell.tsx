'use client'

import { usePathname } from 'next/navigation'
import { AppNav } from './app-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const customerPage = pathname.startsWith('/mutabakat/itiraz/')
  const barePage = customerPage || pathname === '/login'

  if (barePage) {
    return <main className="min-h-screen bg-slate-50 px-4 py-6">{children}</main>
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
