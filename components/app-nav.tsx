'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mail, MessageCircle } from 'lucide-react'
import { AuthActions } from '@/components/auth-actions'
import { cn } from '@/lib/utils'

const mainLinks = [
  { href: '/', label: 'Özet', match: (path: string) => path === '/' },
  { href: '/cariler', label: 'Cariler', match: (path: string) => path.startsWith('/cariler') },
]

const commLinks = [
  { href: '/mutabakat', label: 'Mutabakat', match: (path: string) => path.startsWith('/mutabakat') && !path.startsWith('/mutabakat/ayarlar') },
  { href: '/hatirlatma', label: 'WhatsApp', match: (path: string) => path.startsWith('/hatirlatma') },
]

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string
  label: string
  active: boolean
  icon?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="group shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              KobiTahsilat
            </p>
            <h1 className="text-lg font-semibold text-slate-900 group-hover:text-brand-700">
              Tahsilat Takip
            </h1>
          </Link>

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
                icon={
                  link.href === '/hatirlatma' ? (
                    <MessageCircle size={15} className="opacity-90" />
                  ) : undefined
                }
              />
            ))}

            <NavItem
              href="/mutabakat/ayarlar"
              label="E-posta"
              active={pathname.startsWith('/mutabakat/ayarlar')}
              icon={<Mail size={15} className="opacity-90" />}
            />

            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline" aria-hidden />

            <AuthActions />
          </nav>
        </div>
      </div>
    </header>
  )
}
