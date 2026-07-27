import { cn } from '@/lib/utils'

export function SummaryStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone: 'ok' | 'candidate' | 'missing'
}) {
  const styles = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    candidate: 'border-amber-200 bg-amber-50 text-amber-800',
    missing: 'border-red-200 bg-red-50 text-red-800',
  }[tone]

  return (
    <div className={cn('rounded-xl border px-4 py-3', styles)}>
      <div className="flex items-center gap-2">
        <span className="opacity-80">{icon}</span>
        <span className="text-xs font-medium leading-tight">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function StatusBadge({
  children,
  tone,
  title,
}: {
  children: React.ReactNode
  tone: 'ok' | 'warn' | 'neutral'
  title?: string
}) {
  const styles = {
    ok: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-amber-100 text-amber-800',
    neutral: 'bg-slate-100 text-slate-700',
  }[tone]

  return (
    <span
      title={title}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        title ? 'cursor-help' : undefined,
        styles
      )}
    >
      {children}
    </span>
  )
}

export function EmptyTableRow({
  colSpan,
  message = 'Eşleşen kayıt bulunamadı.',
}: {
  colSpan: number
  message?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-slate-500">
        {message}
      </td>
    </tr>
  )
}

export function FilterBar({
  children,
  resultText,
}: {
  children: React.ReactNode
  resultText?: string
}) {
  return (
    <div className="mt-5 space-y-2">
      <div className="flex flex-col gap-3 md:flex-row">{children}</div>
      {resultText ? <p className="text-xs text-slate-500">{resultText}</p> : null}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  icon: React.ReactNode
}) {
  return (
    <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/30">
      <span className="text-slate-400">{icon}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full py-2.5 text-sm outline-none"
      />
    </label>
  )
}

export function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30 md:min-w-48"
    >
      {children}
    </select>
  )
}
