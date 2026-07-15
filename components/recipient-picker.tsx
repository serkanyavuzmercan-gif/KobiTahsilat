'use client'

import { Mail } from 'lucide-react'

/**
 * Alıcı e-posta seçici. Cari'de keşfedilen tüm adresleri listeler; VARSAYILAN olarak
 * yalnız ilki (birincil) seçilidir. Kullanıcı bilerek birden fazla seçebilir ama sistem
 * ASLA hepsine birden otomatik göndermez — yalnız seçili olanlara gider.
 */
export function RecipientPicker({
  addresses,
  selected,
  onChange,
}: {
  addresses: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  if (addresses.length === 0) return null

  // Tek adres varsa seçim gereksiz; sadece göster.
  if (addresses.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <Mail size={13} className="text-brand-600" />
        <span className="font-medium">{addresses[0]}</span>
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
        Alıcı ({selected.length} seçili) — yalnız seçili adrese(lere) gider
      </p>
      <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5">
        {addresses.map((addr, index) => (
          <label
            key={addr}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(addr)}
              onChange={() => toggle(addr)}
              className="h-3.5 w-3.5 shrink-0 accent-brand-600"
            />
            <span className={selected.includes(addr) ? 'text-slate-800' : 'text-slate-500'}>
              {addr}
            </span>
            {index === 0 && (
              <span className="ml-auto shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                varsayılan
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}
