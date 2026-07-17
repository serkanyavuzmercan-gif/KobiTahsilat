'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Handshake, MessageCircle, Settings2 } from 'lucide-react'
import { AppBrand } from '@/components/app-brand'
import { AuthActions } from '@/components/auth-actions'
import { cn } from '@/lib/utils'

const mainLinks = [
  { href: '/', label: 'Özet', match: (path: string) => path === '/' },
  { href: '/cariler', label: 'Cariler', match: (path: string) => path.startsWith('/cariler') },
]

// İki ana aksiyon: her biri kendi rengi + sembolüyle listeden ayrışır.
const commLinks = [
  {
    href: '/mutabakat',
    label: 'Mutabakat Yap',
    match: (path: string) => path.startsWith('/mutabakat') && !path.startsWith('/mutabakat/ayarlar'),
    icon: <Handshake size={15} className="opacity-90" />,
    idle: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
    activeCls: 'bg-violet-600 text-white shadow-sm',
  },
  {
    href: '/hatirlatma',
    label: 'Ödeme Talebi Gönder',
    match: (path: string) => path.startsWith('/hatirlatma'),
    icon: <MessageCircle size={15} className="opacity-90" />,
    idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    activeCls: 'bg-emerald-600 text-white shadow-sm',
  },
]

function NavItem({
  href,
  label,
  active,
  icon,
  idle,
  activeCls,
}: {
  href: string
  label: string
  active: boolean
  icon?: React.ReactNode
  /** Aksiyon linkleri için özel arka plan (pasif). Verilmezse sade nav stili. */
  idle?: string
  /** Aksiyon linkleri için özel arka plan (aktif). */
  activeCls?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
        active
          ? activeCls || 'bg-brand-600 text-white shadow-sm'
          : idle || 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      {icon}
      {label}
    </Link>
  )
}

export function AppNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="w-full px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppBrand />

          <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {mainLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                active={link.match(pathname)}
              />
            ))}

            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline" aria-hidden />

            {commLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                active={link.match(pathname)}
                icon={link.icon}
                idle={link.idle}
                activeCls={link.activeCls}
              />
            ))}

            <NavItem
              href="/ayarlar"
              label="Otomasyon Ayarları"
              active={pathname.startsWith('/ayarlar') || pathname.startsWith('/mutabakat/ayarlar')}
              icon={<Settings2 size={15} className="opacity-90" />}
            />

            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline" aria-hidden />

            <AuthActions />
          </nav>
        </div>
      </div>
    </header>
  )
}
