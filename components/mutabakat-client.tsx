'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  MailWarning,
  Search,
} from 'lucide-react'
import { PreviewLink } from '@/components/ui/button'
import {
  EmptyTableRow,
  FilterBar,
  FilterSelect,
  SearchInput,
  StatusBadge,
  SummaryStat,
} from '@/components/ui/summary-stat'
import { MutabakatEmailSecici } from '@/components/mutabakat-email-secici'
import type { MutabakatCari } from '@/lib/mutabakat-data'
import { formatTL } from '@/lib/types'

const SAYFA_BOYUTU = 50

export function MutabakatClient({
  cariler,
  snapshotTarihi,
  sendEnabled,
}: {
  cariler: MutabakatCari[]
  snapshotTarihi: string
  sendEnabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [emailFilter, setEmailFilter] = useState<'all' | 'ready' | 'unselected' | 'missing'>('all')
  // Taban bakiye: altındaki cariler mutabakata gelmesin (kullanıcı incelerken belirler).
  const [tabanBakiye, setTabanBakiye] = useState(0)

  // Önce taban bakiye kapısı: bunun altındaki cariler mutabakat kapsamı dışında (özet + liste).
  const kapsamdaki = useMemo(
    () => cariler.filter((cari) => cari.bakiye >= tabanBakiye),
    [cariler, tabanBakiye]
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return kapsamdaki.filter((cari) => {
      const matchesSearch =
        !term ||
        cari.firma_adi.toLocaleLowerCase('tr').includes(term) ||
        cari.cari_kod.toLocaleLowerCase('tr').includes(term) ||
        cari.email_havuzu.some((email) => email.includes(term))
      const matchesEmail =
        emailFilter === 'all' ||
        (emailFilter === 'ready' && Boolean(cari.email)) ||
        (emailFilter === 'unselected' && !cari.email && cari.email_havuzu.length > 0) ||
        (emailFilter === 'missing' && cari.email_havuzu.length === 0)
      return matchesSearch && matchesEmail
    })
  }, [kapsamdaki, emailFilter, query])

  const ready = kapsamdaki.filter((cari) => cari.email).length
  const secilmemis = kapsamdaki.filter((cari) => !cari.email && cari.email_havuzu.length > 0).length
  const epostaYok = kapsamdaki.filter((cari) => cari.email_havuzu.length === 0).length

  // Sayfalama: tüm kayıtları tek seferde basmak yavaş → 50'lik sayfalar.
  const [sayfa, setSayfa] = useState(1)
  useEffect(() => setSayfa(1), [query, emailFilter, tabanBakiye])
  const toplamSayfa = Math.max(1, Math.ceil(filtered.length / SAYFA_BOYUTU))
  const aktifSayfa = Math.min(sayfa, toplamSayfa)
  const baslangic = (aktifSayfa - 1) * SAYFA_BOYUTU
  const sayfalik = filtered.slice(baslangic, baslangic + SAYFA_BOYUTU)

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Bakiye mutabakatı</h2>
              <StatusBadge tone={sendEnabled ? 'ok' : 'warn'}>
                {sendEnabled ? 'Gönderim açık' : 'Gönderim kapalı'}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dönem: {snapshotTarihi} · Gönderici e-posta bağlantıları{' '}
              <Link href="/ayarlar#eposta" className="font-medium text-brand-600 hover:underline">
                ayarlardan
              </Link>{' '}
              yönetilir.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:max-w-xl">
            <SummaryStat icon={<CheckCircle2 size={18} />} label="Gönderime hazır" value={ready} tone="ok" />
            <SummaryStat icon={<Mail size={18} />} label="Alıcı seçilmemiş" value={secilmemis} tone="candidate" />
            <SummaryStat icon={<MailWarning size={18} />} label="E-posta yok" value={epostaYok} tone="missing" />
          </div>
        </div>

        <FilterBar
          resultText={`${filtered.length} firma listeleniyor${
            tabanBakiye > 0 ? ` · taban ${formatTL(tabanBakiye)}` : ''
          }${filtered.length !== cariler.length ? ` (${cariler.length} toplam)` : ''}`}
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Firma, cari kod veya e-posta ara…"
            icon={<Search size={17} />}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Taban bakiye (₺)</span>
            <input
              type="number"
              min={0}
              step={100}
              value={tabanBakiye || ''}
              onChange={(event) => {
                const value = Number(event.target.value)
                setTabanBakiye(Number.isFinite(value) && value > 0 ? value : 0)
              }}
              placeholder="0"
              title="Bu tutarın altındaki bakiyeli cariler mutabakata gelmez"
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <FilterSelect value={emailFilter} onChange={(value) => setEmailFilter(value as typeof emailFilter)}>
            <option value="all">Tüm firmalar</option>
            <option value="ready">Alıcı seçili (hazır)</option>
            <option value="unselected">Alıcı seçilmemiş</option>
            <option value="missing">E-posta yok</option>
          </FilterSelect>
        </FilterBar>
      </section>

      <section className="table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">E-posta</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
                <th className="px-4 py-3 text-right">Gecikmiş</th>
                <th className="px-4 py-3">Son gönderim</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Arama veya filtreye uygun firma bulunamadı." />
              ) : (
                sayfalik.map((cari) => (
                  <tr key={cari.cari_kod}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{cari.firma_adi}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{cari.cari_kod}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <MutabakatEmailSecici
                        cariKod={cari.cari_kod}
                        havuz={cari.email_havuzu}
                        secili={cari.email_adresleri}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatTL(cari.bakiye)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-red-700">
                      {formatTL(cari.gecikmis_bakiye)}
                    </td>
                    <td className="px-4 py-3">
                      {cari.mutabakat_son_gonderim ? (
                        <div className="flex items-start gap-2 text-slate-700">
                          <CalendarClock size={16} className="mt-0.5 shrink-0 text-brand-600" />
                          <div>
                            <p className="whitespace-nowrap font-medium">
                              {new Date(cari.mutabakat_son_gonderim).toLocaleDateString('tr-TR')}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(cari.mutabakat_son_gonderim).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {cari.mutabakat_gonderim_sayisi > 1
                                ? ` · ${cari.mutabakat_gonderim_sayisi} gönderim`
                                : ''}
                            </p>
                            {cari.mutabakat_gonderim_engelli &&
                              cari.mutabakat_tekrar_gonderilebilir_at && (
                                <p className="mt-1 max-w-36 text-xs font-medium text-amber-700">
                                  8 iş günü dolmadan gönderilemez ·{' '}
                                  {new Date(cari.mutabakat_tekrar_gonderilebilir_at).toLocaleDateString(
                                    'tr-TR'
                                  )}
                                </p>
                              )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Henüz gönderilmedi</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <PreviewLink href={`/mutabakat/${encodeURIComponent(cari.cari_kod)}`}>
                        <Eye size={15} />
                        Mutabakat Yap
                      </PreviewLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              {baslangic + 1}–{Math.min(baslangic + SAYFA_BOYUTU, filtered.length)} / {filtered.length}{' '}
              firma
            </p>
            {toplamSayfa > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSayfa((p) => Math.max(1, p - 1))}
                  disabled={aktifSayfa <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Önceki
                </button>
                <span className="px-2 text-xs font-medium tabular-nums text-slate-600">
                  Sayfa {aktifSayfa} / {toplamSayfa}
                </span>
                <button
                  type="button"
                  onClick={() => setSayfa((p) => Math.min(toplamSayfa, p + 1))}
                  disabled={aktifSayfa >= toplamSayfa}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sonraki
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
