'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SortableTh({
  label,
  active,
  direction,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc' | null
  onClick: () => void
  align?: 'left' | 'right'
}) {
  const Icon = !active || !direction ? ArrowUpDown : direction === 'desc' ? ArrowDown : ArrowUp

  return (
    <th className={cn('px-4 py-3', align === 'right' && 'text-right')}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
          active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800',
          align === 'right' && 'ml-auto'
        )}
      >
        {label}
        <Icon size={14} className={active ? 'opacity-100' : 'opacity-50'} />
      </button>
    </th>
  )
}
