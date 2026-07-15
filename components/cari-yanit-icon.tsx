'use client'

import { useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import { YanitDetailModal } from '@/components/yanit-detail-modal'
import type { CariYanitKayit } from '@/lib/types'

export function CariYanitIcon({
  kanal,
  yanitlar,
  okunmamis,
  cariKod,
  firmaAdi,
  onMarkedRead,
}: {
  kanal: 'email' | 'whatsapp'
  yanitlar: CariYanitKayit[]
  okunmamis: number
  cariKod: string
  firmaAdi: string
  onMarkedRead?: (yanitIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = kanal === 'email' ? Mail : MessageCircle

  if (!yanitlar.length) {
    return <span className="text-xs text-slate-300">—</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${kanal === 'email' ? 'E-posta' : 'WhatsApp'} yanıtlarını görüntüle`}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          kanal === 'email'
            ? 'border-slate-200 bg-white text-brand-600 hover:border-brand-200 hover:bg-brand-50'
            : 'border-emerald-100 bg-emerald-50/50 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50'
        }`}
      >
        <Icon size={17} />
        {okunmamis > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {okunmamis > 9 ? '9+' : okunmamis}
          </span>
        ) : null}
      </button>

      <YanitDetailModal
        open={open}
        onClose={() => setOpen(false)}
        title={firmaAdi}
        kanal={kanal}
        yanitlar={yanitlar}
        cariKod={cariKod}
        onMarkedRead={(ids) => {
          onMarkedRead?.(ids)
        }}
      />
    </>
  )
}
