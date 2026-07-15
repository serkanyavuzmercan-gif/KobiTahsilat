'use client'

import { Check, Mail, MessageCircle, X } from 'lucide-react'

/**
 * Alıcı seçici (e-posta veya telefon). Cari'de keşfedilen tüm adresleri/numaraları listeler;
 * VARSAYILAN olarak yalnız ilki (birincil) seçilidir. Kullanıcı bilerek birden fazla seçebilir
 * ama sistem ASLA hepsine birden otomatik göndermez — yalnız seçili olanlara gider.
 */
export function RecipientPicker({
  addresses,
  selected,
  onChange,
  kind = 'email',
  format = (v) => v,
  onRemove,
}: {
  addresses: string[]
  selected: string[]
  onChange: (next: string[]) => void
  kind?: 'email' | 'phone'
  format?: (v: string) => string
  onRemove?: (addr: string) => void
}) {
  if (addresses.length === 0) return null
  const Icon = kind === 'phone' ? MessageCircle : Mail
  const iconClass = kind === 'phone' ? 'text-emerald-600' : 'text-brand-600'
  const noun = kind === 'phone' ? 'Numara' : 'Alıcı'

  // Tek adres varsa seçim gereksiz; sadece göster (silme yine mümkün).
  if (addresses.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <Icon size={13} className={iconClass} />
        <span className="font-medium">{format(addresses[0])}</span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(addresses[0])}
            title="Bu adresi kalıcı olarak sil"
            className="ml-auto rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
          >
            <X size={13} />
          </button>
        )}
      </div>
    )
  }

  function toggle(addr: string) {
    if (selected.includes(addr)) {
      onChange(selected.filter((item) => item !== addr))
    } else {
      onChange([...selected, addr])
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-600">
        {noun} ({selected.length} seçili) — yalnız seçili{kind === 'phone' ? ' numaraya' : ' adrese'}(lere) gider
      </p>
      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5">
        {addresses.map((addr, index) => {
          const isSel = selected.includes(addr)
          return (
            <div
              key={addr}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50"
            >
              <button
                type="button"
                onClick={() => toggle(addr)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isSel
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isSel && <Check size={11} strokeWidth={3} />}
                </span>
                <span className={`truncate ${isSel ? 'text-slate-800' : 'text-slate-500'}`}>
                  {format(addr)}
                </span>
                {index === 0 && (
                  <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                    varsayılan
                  </span>
                )}
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(addr)}
                  title="Bu adresi kalıcı olarak sil"
                  className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
