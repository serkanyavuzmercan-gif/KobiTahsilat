'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CarilerClient from '@/components/cariler-client'
import { YanitlarPanel } from '@/components/yanitlar-panel'
import type { CariBakiye, CariYanitKayit, CariYanitOzet } from '@/lib/types'

export function CarilerPageClient({
  cariler,
  toplam,
  sourcedAt,
  yanitlar,
  inbox,
}: {
  cariler: CariBakiye[]
  toplam: number
  sourcedAt: string
  yanitlar: Record<string, CariYanitOzet>
  inbox: CariYanitKayit[]
}) {
  const searchParams = useSearchParams()
  const [tab, setTabState] = useState<'liste' | 'yanitlar'>(
    searchParams.get('tab') === 'yanitlar' ? 'yanitlar' : 'liste'
  )

  const [yanitState, setYanitState] = useState({ yanitlar, inbox })

  useEffect(() => {
    setYanitState({ yanitlar, inbox })
  }, [yanitlar, inbox])

  const unreadTotal = useMemo(
    () => yanitState.inbox.filter((item) => !item.okundu).length,
    [yanitState.inbox]
  )

  // Sekme geçişi tamamen client-side: sunucuyu yeniden tetiklemez (hızlı). URL yalnız
  // history ile güncellenir (paylaşılabilirlik korunur, Next navigasyonu tetiklenmez).
  function setTab(next: 'liste' | 'yanitlar') {
    setTabState(next)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (next === 'yanitlar') params.set('tab', 'yanitlar')
      else params.delete('tab')
      const query = params.toString()
      window.history.replaceState(null, '', query ? `/cariler?${query}` : '/cariler')
    }
  }

  // Okundu işaretleme yalnız optimistik yapılır; router.refresh YOK (aksi halde sunucu
  // tüm veriyi baştan çeker ve rozet eski sayıya geri döner). Kalıcı kayıt DB'ye yazılır.
  function handleMarkedRead(yanitIds: string[]) {
    const idSet = new Set(yanitIds)
    setYanitState((current) => {
      const mark = (item: CariYanitKayit) =>
        idSet.has(item.id) ? { ...item, okundu: true } : item

      const inbox = current.inbox.map(mark)
      const yanitlar = Object.fromEntries(
        Object.entries(current.yanitlar).map(([kod, ozet]) => {
          const email = ozet.email.map(mark)
          const whatsapp = ozet.whatsapp.map(mark)
          return [
            kod,
            {
              email,
              whatsapp,
              son_email: email[0] || null,
              son_whatsapp: whatsapp[0] || null,
              okunmamis_email: email.filter((item) => !item.okundu).length,
              okunmamis_whatsapp: whatsapp.filter((item) => !item.okundu).length,
            },
          ]
        })
      )
      return { inbox, yanitlar }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setTab('liste')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'liste'
              ? 'border-b-2 border-brand-600 text-brand-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Cari listesi
        </button>
        <button
          type="button"
          onClick={() => setTab('yanitlar')}
          className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'yanitlar'
              ? 'border-b-2 border-brand-600 text-brand-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Yanıtlar
          {unreadTotal > 0 ? (
            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          ) : null}
        </button>
      </div>

      {tab === 'liste' ? (
        <CarilerClient
          cariler={cariler}
          toplam={toplam}
          sourcedAt={sourcedAt}
          yanitlar={yanitState.yanitlar}
          onMarkedRead={handleMarkedRead}
        />
      ) : (
        <YanitlarPanel inbox={yanitState.inbox} onMarkedRead={handleMarkedRead} />
      )}
    </div>
  )
}
