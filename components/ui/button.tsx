import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

export const buttonVariants = {
  primary: `${base} bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-slate-300 disabled:text-slate-600`,
  secondary: `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`,
  danger: `${base} border border-red-200 bg-white text-red-700 hover:bg-red-50`,
  success: `${base} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600`,
  preview: `${base} bg-brand-600 px-3 py-2 text-xs text-white shadow-sm hover:bg-brand-700`,
  ghost: `${base} text-slate-700 hover:bg-slate-100`,
} as const

export function Button({
  variant = 'primary',
  className,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants
  children: ReactNode
}) {
  return (
    <button type={type} className={cn(buttonVariants[variant], 'px-4 py-2.5', className)} {...props}>
      {children}
    </button>
  )
}

export function PreviewLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={cn(buttonVariants.preview, 'whitespace-nowrap', className)}>
      {children}
    </Link>
  )
}

export function BackLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
    >
      <ArrowLeft size={16} className="shrink-0" />
      {children}
    </Link>
  )
}
