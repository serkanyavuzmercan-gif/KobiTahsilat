import Image from 'next/image'
import Link from 'next/link'

export function AppBrand({
  compact = false,
  href = '/',
}: {
  compact?: boolean
  href?: string
}) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition group-hover:border-brand-200 group-hover:shadow">
        <Image
          src="/hidroteknik-logo.png"
          alt="Hidroteknik"
          width={132}
          height={64}
          className="h-auto w-full max-h-8 object-contain"
          priority
        />
      </span>
      <span className="min-w-0">
        <span
          className={`block font-semibold tracking-tight text-brand-700 transition group-hover:text-brand-800 ${
            compact ? 'text-base' : 'text-lg'
          }`}
        >
          KobiTahsilat
        </span>
        <span className="mt-0.5 block text-xs leading-tight text-slate-500">
          Açık alacaklarınızı tek ekrandan yönetin
        </span>
      </span>
    </Link>
  )
}
