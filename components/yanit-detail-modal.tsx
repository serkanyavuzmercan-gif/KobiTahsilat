'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LoaderCircle, Mail, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CariYanitKayit } from '@/lib/types'

async function markOkundu(yanitIds: string[]) {
  await fetch('/api/cariler/yanit-okundu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yanitIds }),
  })
}

export function YanitDetailModal({
  open,
  onClose,
  title,
  kanal,
  yanitlar,
  cariKod,
  onMarkedRead,
}: {
  open: boolean
  onClose: () => void
  title: string
  kanal: 'email' | 'whatsapp'
  yanitlar: CariYanitKayit[]
  cariKod?: string
  onMarkedRead?: (yanitIds: string[]) => void
}) {
  const [marking, setMarking] = useState(false)
  const Icon = kanal === 'email' ? Mail : MessageCircle
  const label = kanal === 'email' ? 'E-posta yanıtları' : 'WhatsApp yanıtları'

  useEffect(() => {
    if (!open) return
    const unread = yanitlar.filter((item) => !item.okundu).map((item) => item.id)
    if (!unread.length) return

    setMarking(true)
    void markOkundu(unread)
      .then(() => onMarkedRead?.(unread))
      .finally(() => setMarking(false))
    // yalnızca modal açıldığında okundu işaretle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/30"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div
            className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
              kanal === 'email' ? 'bg-slate-50' : 'bg-emerald-50/60'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Icon size={16} className={kanal === 'email' ? 'text-brand-600' : 'text-emerald-600'} />
                {label}
              </div>
              <p className="mt-1 text-sm text-slate-600">{title}</p>
              {cariKod ? (
                <Link
                  href={`/cariler/${encodeURIComponent(cariKod)}`}
                  className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                >
                  Cari detayına git →
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
              aria-label="Kapat"
            >
              <X size={18} />
            </button>
          </div>

          <ul className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto p-5">
            {yanitlar.map((yanit) => (
              <li
                key={yanit.id}
                className={`rounded-xl border p-3 ${
                  yanit.okundu ? 'border-slate-100 bg-white' : 'border-brand-100 bg-brand-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>{new Date(yanit.tarih).toLocaleString('tr-TR')}</span>
                  <span className="flex items-center gap-2">
                    {!yanit.okundu && marking ? (
                      <LoaderCircle size={12} className="animate-spin text-brand-600" />
                    ) : null}
                    {!yanit.okundu && !marking ? (
                      <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Yeni
                      </span>
                    ) : (
                      <span className="text-slate-400">Okundu</span>
                    )}
                  </span>
                </div>
                {yanit.gonderen ? (
                  <p className="mt-1 text-xs text-slate-500">{yanit.gonderen}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {yanit.detay}
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 px-5 py-3 text-right">
            <Button variant="secondary" onClick={onClose} className="px-3 py-2 text-xs">
              Kapat
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
