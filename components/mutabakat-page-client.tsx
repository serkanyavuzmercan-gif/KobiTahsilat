'use client'

import { useState } from 'react'
import { MutabakatClient } from '@/components/mutabakat-client'
import { MutabakatSonuclar } from '@/components/mutabakat-sonuclar'
import type { MutabakatCari } from '@/lib/mutabakat-data'
import type { MutabakatSonuc } from '@/lib/cari-yanitlar'

export function MutabakatPageClient({
  cariler,
  snapshotTarihi,
  sendEnabled,
  sonuclar,
}: {
  cariler: MutabakatCari[]
  snapshotTarihi: string
  sendEnabled: boolean
  sonuclar: MutabakatSonuc[]
}) {
  const [tab, setTab] = useState<'liste' | 'sonuclar'>('liste')

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
          Mutabakat listesi
        </button>
        <button
          type="button"
          onClick={() => setTab('sonuclar')}
          className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'sonuclar'
              ? 'border-b-2 border-brand-600 text-brand-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Sonuçlar (onay / itiraz)
          {sonuclar.length > 0 ? (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
              {sonuclar.length > 99 ? '99+' : sonuclar.length}
            </span>
          ) : null}
        </button>
      </div>

      {tab === 'liste' ? (
        <MutabakatClient cariler={cariler} snapshotTarihi={snapshotTarihi} sendEnabled={sendEnabled} />
      ) : (
        <MutabakatSonuclar sonuclar={sonuclar} />
      )}
    </div>
  )
}
