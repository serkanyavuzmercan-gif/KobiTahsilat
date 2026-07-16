'use client'

import { useState } from 'react'
import { Check, Mail, MessageCircle, Plus, X } from 'lucide-react'
import { isMobileTurkey, normalizePhone } from '@/lib/phone'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Alıcı seçici (e-posta veya telefon). Cari'de keşfedilen tüm adresleri/numaraları listeler;
 * VARSAYILAN olarak yalnız ilki (birincil) seçilidir. Kullanıcı bilerek birden fazla seçebilir
 * ama sistem ASLA hepsine birden otomatik göndermez — yalnız seçili olanlara gider.
 *
 * onAdd verilirse listede olmayan **özel** bir numara/e-posta elle eklenebilir (doğrulanır).
 */
export function RecipientPicker({
  addresses,
  selected,
  onChange,
  kind = 'email',
  format = (v) => v,
  onRemove,
  onAdd,
}: {
  addresses: string[]
  selected: string[]
  onChange: (next: string[]) => void
  kind?: 'email' | 'phone'
  format?: (v: string) => string
  onRemove?: (addr: string) => void
  onAdd?: (value: string) => void
}) {
  const Icon = kind === 'phone' ? MessageCircle : Mail
  const iconClass = kind === 'phone' ? 'text-emerald-600' : 'text-brand-600'
  const noun = kind === 'phone' ? 'Numara' : 'Alıcı'

  function toggle(addr: string) {
    if (selected.includes(addr)) {
      onChange(selected.filter((item) => item !== addr))
    } else {
      onChange([...selected, addr])
    }
  }

  const cokAdres = addresses.length > 1

  return (
    <div className="space-y-1.5">
      {addresses.length === 1 && (
        // Tek adres: seçim gereksiz; sadece göster (silme yine mümkün).
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
      )}

      {cokAdres && (
        <>
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
        </>
      )}

      {onAdd && <CustomAddRow kind={kind} onAdd={onAdd} bosMu={addresses.length === 0} />}
    </div>
  )
}

/** Listede olmayan özel numara/e-posta ekleme satırı (doğrulamalı). */
function CustomAddRow({
  kind,
  onAdd,
  bosMu,
}: {
  kind: 'email' | 'phone'
  onAdd: (value: string) => void
  bosMu: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const placeholder = kind === 'phone' ? 'Farklı numara ekle (0532 …)' : 'Farklı e-posta ekle'

  function ekle() {
    const raw = value.trim()
    if (!raw) return
    if (kind === 'phone') {
      const e164 = normalizePhone(raw)
      if (!e164 || !isMobileTurkey(e164)) {
        setError('Geçerli bir cep numarası girin (05xx …).')
        return
      }
      onAdd(e164)
    } else {
      const email = raw.toLowerCase()
      if (!EMAIL_RE.test(email)) {
        setError('Geçerli bir e-posta girin.')
        return
      }
      onAdd(email)
    }
    setValue('')
    setError('')
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ekle()
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={ekle}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <Plus size={13} />
          Ekle
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
      {bosMu && !error && (
        <p className="mt-1 text-[11px] text-slate-400">
          Kayıtlı {kind === 'phone' ? 'numara' : 'e-posta'} yok — elle ekleyebilirsiniz.
        </p>
      )}
    </div>
  )
}
