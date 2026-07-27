import Image from 'next/image'
import Link from 'next/link'
import { APP_VERSION } from '@/lib/app-version'

export function AppBrand({
  compact = false,
  href = '/',
}: {
  compact?: boolean
  href?: string
}) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-3.5">
      <Image
        src="/hidroteknik-logo.png"
        alt="Hidroteknik"
        width={172}
        height={35}
        className={`h-auto w-auto object-contain transition-opacity group-hover:opacity-90 ${
          compact ? 'max-h-8' : 'max-h-10 sm:max-h-11'
        }`}
        style={{ width: compact ? 132 : 172, height: 'auto' }}
        priority
      />
      <span className="min-w-0 border-l border-slate-200 pl-3.5">
        <span
          className={`block font-semibold leading-tight tracking-tight text-brand-700 transition group-hover:text-brand-800 ${
            compact ? 'text-sm' : 'text-[15px] sm:text-base'
          }`}
        >
          Mutabakat ve Tahsilat Sistemi
        </span>
        <span className="mt-0.5 block font-mono text-xs leading-tight tracking-wide text-slate-400">
          {APP_VERSION}
        </span>
      </span>
    </Link>
  )
}
