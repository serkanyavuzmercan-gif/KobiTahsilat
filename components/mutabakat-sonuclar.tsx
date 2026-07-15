'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Search, TriangleAlert } from 'lucide-react'
import { FilterBar, FilterSelect, SearchInput, StatusBadge, SummaryStat } from '@/components/ui/summary-stat'
import type { MutabakatSonuc } from '@/lib/cari-yanitlar'

export function MutabakatSonuclar({ sonuclar }: { sonuclar: MutabakatSonuc[] }) {
  const [query, setQuery] = useState('')
  const [tipFilter, setTipFilter] = useState<'all' | 'onay' | 'itiraz'>('all')

  const onaySayisi = sonuclar.filter((s) => s.tip === 'onay').length
  const itirazSayisi = sonuclar.filter((s) => s.tip === 'itiraz').length

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return sonuclar.filter((s) => {
      const matchesTip = tipFilter === 'all' || s.tip === tipFilter
      const matchesSearch =
        !term ||
        s.firma_adi.toLocaleLowerCase('tr').includes(term) ||
        s.cari_kod.toLocaleLowerCase('tr').includes(term) ||
        s.aciklama.toLocaleLowerCase('tr').includes(term)
      return matchesTip && matchesSearch
    })
  }, [sonuclar, tipFilter, query])

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h2 className="text-lg font-semibold">Mutabakat sonuçları</h2>
            <p className="mt-1 text-sm text-slate-500">
              Müşterilerin gönderdiği <strong>onay</strong> ve <strong>fark/itiraz</strong>{' '}
              yanıtları. Her yanıt ayrıca e-posta ile de iletilir.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:max-w-sm">
            <SummaryStat icon={<CheckCircle2 size={18} />} label="Onay" value={onaySayisi} tone="ok" />
            <SummaryStat icon={<TriangleAlert size={18} />} label="Fark / itiraz" value={itirazSayisi} tone="missing" />
          </div>
        </div>

        <FilterBar resultText={`${filtered.length} yanıt listeleniyor`}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Firma, cari kod veya açıklama ara…"
            icon={<Search size={17} />}
          />
          <FilterSelect value={tipFilter} onChange={(value) => setTipFilter(value as typeof tipFilter)}>
            <option value="all">Tümü</option>
            <option value="onay">Yalnız onaylar</option>
            <option value="itiraz">Yalnız itirazlar</option>
          </FilterSelect>
        </FilterBar>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Henüz mutabakat yanıtı yok.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border bg-white p-4 ${
                s.tip === 'onay' ? 'border-emerald-200' : 'border-red-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.tip === 'onay' ? (
                      <StatusBadge tone="ok">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 size={12} /> Onay
                        </span>
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="warn">
                        <span className="inline-flex items-center gap-1">
                          <TriangleAlert size={12} /> Fark / itiraz
                        </span>
                      </StatusBadge>
                    )}
                    <Link
                      href={`/cariler/${encodeURIComponent(s.cari_kod)}`}
                      className="truncate text-sm font-semibold text-slate-800 hover:text-brand-700 hover:underline"
                    >
                      {s.firma_adi}
                    </Link>
                    <span className="font-mono text-xs text-slate-400">{s.cari_kod}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {s.tarih ? new Date(s.tarih).toLocaleString('tr-TR') : ''}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {s.aciklama || '—'}
              </p>

              {s.iletisim && (
                <p className="mt-2 text-xs text-slate-500">
                  İletişim: <span className="font-medium text-slate-700">{s.iletisim}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
