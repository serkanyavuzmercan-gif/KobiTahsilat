'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import {
  cariOrtalamaGecikmeGun,
  formatGecikmeGun,
  portfoyOrtalamaGecikmeGun,
} from '@/lib/gecikme'
import { EmptyTableRow, FilterBar, SearchInput } from '@/components/ui/summary-stat'
import { formatNumber } from '@/lib/types'
import type { CariBakiye } from '@/lib/types'

export default function CarilerClient({
  cariler,
  toplam,
  sourcedAt,
}: {
  cariler: CariBakiye[]
  toplam: number
  sourcedAt: string
}) {
  const [q, setQ] = useState('')
  const [minBakiye, setMinBakiye] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr')
    const min = minBakiye ? Number(minBakiye.replace(',', '.')) : 0
    return cariler.filter((c) => {
      const match =
        !term ||
        c.firma_adi.toLocaleLowerCase('tr').includes(term) ||
        c.cari_kod.toLocaleLowerCase('tr').includes(term)
      const okMin = !min || c.bakiye >= min
      return match && okMin
    })
  }, [cariler, q, minBakiye])

  const filtToplam = filtered.reduce((s, c) => s + c.bakiye, 0)
  const ortalamaGecikme = useMemo(
    () => portfoyOrtalamaGecikmeGun(filtered),
    [filtered]
  )

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-xl font-semibold">Açık tahsilat carileri</h2>
        <p className="mt-1 text-sm text-slate-500">
          {cariler.length} cari · Toplam {formatNumber(toplam)} ₺ · Snapshot:{' '}
          {new Date(sourcedAt).toLocaleString('tr-TR')}
        </p>
        <FilterBar
          resultText={`Filtre sonucu: ${filtered.length} cari · ${formatNumber(filtToplam)} ₺${
            ortalamaGecikme != null ? ` · Ortalama gecikme: ${formatGecikmeGun(ortalamaGecikme)}` : ''
          }`}
        >
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Firma adı veya cari kod ara…"
            icon={<Search size={17} />}
          />
          <input
            value={minBakiye}
            onChange={(e) => setMinBakiye(e.target.value)}
            placeholder="Min. bakiye"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30 md:min-w-40 md:max-w-48"
          />
        </FilterBar>
      </section>

      <section className="table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cari kod</th>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Ödeme vadesi</th>
                <th className="px-4 py-3 text-right">Ort. gecikme</th>
                <th className="px-4 py-3 text-right">Gecikmiş</th>
                <th className="px-4 py-3 text-right">Bakiye (₺)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Eşleşen cari bulunamadı." />
              ) : (
                filtered.map((c, i) => (
                  <tr key={c.cari_kod}>
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.cari_kod}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cariler/${encodeURIComponent(c.cari_kod)}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {c.firma_adi}
                      </Link>
                      <p
                        className={`mt-0.5 text-xs ${
                          c.email
                            ? 'text-slate-500'
                            : c.email_adaylari.length
                              ? 'text-amber-600'
                              : 'text-red-500'
                        }`}
                      >
                        {c.email_adresleri.length
                          ? c.email_adresleri.join(', ')
                          : c.email_adaylari.length
                            ? `Gmail adayı: ${c.email_adaylari[0].email}`
                            : 'E-posta adresi yok'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.odeme_vadesi || '—'}
                      {c.vade_gun != null ? (
                        <span className="ml-1 text-xs text-slate-400">({c.vade_gun}g)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatGecikmeGun(cariOrtalamaGecikmeGun(c))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-red-700">
                      {formatNumber(c.gecikmis_bakiye)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatNumber(c.bakiye)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-600">
                    Ortalama gecikme süresi
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-700">
                    {formatGecikmeGun(ortalamaGecikme)}
                  </td>
                  <td colSpan={2} className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Ortalama gecikme, vadesi geçmiş açık kalemler üzerinden tutar ağırlıklı hesaplanır.
        </p>
      </section>
    </div>
  )
}
