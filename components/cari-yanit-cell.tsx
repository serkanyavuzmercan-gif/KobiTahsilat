'use client'

import { useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import type { CariYanitKayit } from '@/lib/types'

export function CariYanitCell({
  kanal,
  yanitlar,
  sonYanit,
}: {
  kanal: 'email' | 'whatsapp'
  yanitlar: CariYanitKayit[]
  sonYanit: CariYanitKayit | null
}) {
  const [open, setOpen] = useState(false)
  const Icon = kanal === 'email' ? Mail : MessageCircle
  const label = kanal === 'email' ? 'E-posta' : 'WhatsApp'

  if (!sonYanit) {
    return <span className="text-xs text-slate-400">—</span>
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`group w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
          kanal === 'email'
            ? 'border-slate-200 bg-slate-50 hover:border-brand-200 hover:bg-brand-50/50'
            : 'border-emerald-100 bg-emerald-50/50 hover:border-emerald-200 hover:bg-emerald-50'
        }`}
      >
        <div className="flex items-center gap-1.5 font-medium text-slate-800">
          <Icon
            size={13}
            className={kanal === 'email' ? 'text-brand-600' : 'text-emerald-600'}
          />
          {new Date(sonYanit.tarih).toLocaleDateString('tr-TR')}
          {yanitlar.length > 1 ? (
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
              +{yanitlar.length - 1}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-slate-600">{sonYanit.ozet}</p>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default bg-black/20"
            aria-label="Kapat"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <p className="text-xs font-semibold text-slate-700">{label} geri dönüşleri</p>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {yanitlar.map((yanit) => (
                <li key={yanit.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{new Date(yanit.tarih).toLocaleString('tr-TR')}</span>
                    {yanit.gonderen ? <span className="truncate">{yanit.gonderen}</span> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                    {yanit.detay}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
