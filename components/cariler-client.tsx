'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Mail, MessageCircle, Search } from 'lucide-react'
import { CariYanitIcon } from '@/components/cari-yanit-icon'
import { SortableTh } from '@/components/sortable-th'
import {
  cariOrtalamaGecikmeGun,
  formatGecikmeGun,
  portfoyOrtalamaGecikmeGun,
} from '@/lib/gecikme'
import { EmptyTableRow, FilterBar, SearchInput } from '@/components/ui/summary-stat'
import { formatNumber } from '@/lib/types'
import type { CariBakiye, CariYanitOzet } from '@/lib/types'
import { TEST_CARI_KODU } from '@/lib/constants'

type SortKey = 'vade_gun' | 'ortalama_gecikme' | 'gecikmis' | 'bakiye'

function nextSortDirection(
  currentKey: SortKey | null,
  currentDir: 'asc' | 'desc' | null,
  key: SortKey
): { key: SortKey; dir: 'asc' | 'desc' } {
  if (currentKey !== key || !currentDir) return { key, dir: 'desc' }
  return { key, dir: currentDir === 'desc' ? 'asc' : 'desc' }
}

function sortValue(cari: CariBakiye, key: SortKey): number | null {
  switch (key) {
    case 'vade_gun':
      return cari.vade_gun ?? null
    case 'ortalama_gecikme':
      return cariOrtalamaGecikmeGun(cari)
    case 'gecikmis':
      return cari.gecikmis_bakiye
    case 'bakiye':
      return cari.bakiye
    default:
      return null
  }
}

export default function CarilerClient({
  cariler,
  toplam,
  sourcedAt,
  yanitlar,
  onMarkedRead,
}: {
  cariler: CariBakiye[]
  toplam: number
  sourcedAt: string
  yanitlar: Record<string, CariYanitOzet>
  onMarkedRead?: (yanitIds: string[]) => void
}) {
  const [q, setQ] = useState('')
  const [minBakiye, setMinBakiye] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)

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

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered

    return [...filtered].sort((a, b) => {
      const aVal = sortValue(a, sortKey)
      const bVal = sortValue(b, sortKey)

      if (aVal == null && bVal == null) return a.firma_adi.localeCompare(b.firma_adi, 'tr')
      if (aVal == null) return 1
      if (bVal == null) return -1

      const diff = aVal - bVal
      return sortDir === 'desc' ? -diff : diff
    })
  }, [filtered, sortKey, sortDir])

  const filtToplam = sorted.reduce((s, c) => s + c.bakiye, 0)
  const ortalamaGecikme = useMemo(
    () => portfoyOrtalamaGecikmeGun(sorted),
    [sorted]
  )

  function handleSort(key: SortKey) {
    const next = nextSortDirection(sortKey, sortDir, key)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-xl font-semibold">Açık tahsilat carileri</h2>
        <p className="mt-1 text-sm text-slate-500">
          {cariler.length} cari · Toplam {formatNumber(toplam)} ₺ · Snapshot:{' '}
          {new Date(sourcedAt).toLocaleString('tr-TR')}
        </p>
        <FilterBar
          resultText={`Filtre sonucu: ${sorted.length} cari · ${formatNumber(filtToplam)} ₺${
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
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cari kod</th>
                <th className="px-4 py-3">Firma</th>
                <SortableTh
                  label="Ödeme vadesi"
                  active={sortKey === 'vade_gun'}
                  direction={sortKey === 'vade_gun' ? sortDir : null}
                  onClick={() => handleSort('vade_gun')}
                />
                <SortableTh
                  label="Ort. gecikme"
                  active={sortKey === 'ortalama_gecikme'}
                  direction={sortKey === 'ortalama_gecikme' ? sortDir : null}
                  onClick={() => handleSort('ortalama_gecikme')}
                  align="right"
                />
                <SortableTh
                  label="Gecikmiş (₺)"
                  active={sortKey === 'gecikmis'}
                  direction={sortKey === 'gecikmis' ? sortDir : null}
                  onClick={() => handleSort('gecikmis')}
                  align="right"
                />
                <SortableTh
                  label="Bakiye (₺)"
                  active={sortKey === 'bakiye'}
                  direction={sortKey === 'bakiye' ? sortDir : null}
                  onClick={() => handleSort('bakiye')}
                  align="right"
                />
                <th className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Mail size={14} />
                    <span className="hidden sm:inline">E-posta</span>
                  </span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MessageCircle size={14} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <EmptyTableRow colSpan={9} message="Eşleşen cari bulunamadı." />
              ) : (
                sorted.map((c, i) => {
                  const cariYanit = yanitlar[c.cari_kod] || {
                    email: [],
                    whatsapp: [],
                    son_email: null,
                    son_whatsapp: null,
                    okunmamis_email: 0,
                    okunmamis_whatsapp: 0,
                  }
                  return (
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
                        {c.cari_kod === TEST_CARI_KODU ? (
                          <span className="ml-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                            Test
                          </span>
                        ) : null}
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
                      <td className="px-4 py-3 text-center align-middle">
                        <CariYanitIcon
                          kanal="email"
                          yanitlar={cariYanit.email}
                          okunmamis={cariYanit.okunmamis_email}
                          cariKod={c.cari_kod}
                          firmaAdi={c.firma_adi}
                          onMarkedRead={(ids) => onMarkedRead?.(ids)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <CariYanitIcon
                          kanal="whatsapp"
                          yanitlar={cariYanit.whatsapp}
                          okunmamis={cariYanit.okunmamis_whatsapp}
                          cariKod={c.cari_kod}
                          firmaAdi={c.firma_adi}
                          onMarkedRead={(ids) => onMarkedRead?.(ids)}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-600">
                    Ortalama gecikme süresi
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-700">
                    {formatGecikmeGun(ortalamaGecikme)}
                  </td>
                  <td colSpan={4} className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Ortalama gecikme, vadesi geçmiş açık kalemler üzerinden tutar ağırlıklı hesaplanır.
          E-posta ve WhatsApp sütunlarındaki simgelere tıklayarak yanıtları görüntüleyebilirsiniz.
          Okunmamış yanıtlar kırmızı bildirim rozeti ile gösterilir. Tüm yanıtlar için{' '}
          <strong>Yanıtlar</strong> sekmesine geçin.
        </p>
      </section>
    </div>
  )
}
