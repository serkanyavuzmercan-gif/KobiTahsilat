'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, Eye, Mail, MailWarning, Search } from 'lucide-react'
import { PreviewLink } from '@/components/ui/button'
import {
  EmptyTableRow,
  FilterBar,
  FilterSelect,
  SearchInput,
  StatusBadge,
  SummaryStat,
} from '@/components/ui/summary-stat'
import type { MutabakatCari } from '@/lib/mutabakat-data'
import { formatTL } from '@/lib/types'

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
  const [emailFilter, setEmailFilter] = useState<'all' | 'ready' | 'candidate' | 'missing'>('all')

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return cariler.filter((cari) => {
      const matchesSearch =
        !term ||
        cari.firma_adi.toLocaleLowerCase('tr').includes(term) ||
        cari.cari_kod.toLocaleLowerCase('tr').includes(term) ||
        cari.email_adresleri.some((email) => email.includes(term)) ||
        cari.email_adaylari.some((aday) => aday.email.includes(term))
      const matchesEmail =
        emailFilter === 'all' ||
        (emailFilter === 'ready' && Boolean(cari.email)) ||
        (emailFilter === 'candidate' && !cari.email && cari.email_adaylari.length > 0) ||
        (emailFilter === 'missing' && !cari.email && cari.email_adaylari.length === 0)
      return matchesSearch && matchesEmail
    })
  }, [cariler, emailFilter, query])

  const ready = cariler.filter((cari) => cari.email).length
  const candidate = cariler.filter((cari) => !cari.email && cari.email_adaylari.length > 0).length
  const missing = cariler.length - ready - candidate

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
            <SummaryStat icon={<Mail size={18} />} label="Onay bekleyen" value={candidate} tone="candidate" />
            <SummaryStat icon={<MailWarning size={18} />} label="E-posta eksik" value={missing} tone="missing" />
          </div>
        </div>

        <FilterBar
          resultText={`${filtered.length} firma listeleniyor${filtered.length !== cariler.length ? ` (${cariler.length} toplam)` : ''}`}
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Firma, cari kod veya e-posta ara…"
            icon={<Search size={17} />}
          />
          <FilterSelect value={emailFilter} onChange={(value) => setEmailFilter(value as typeof emailFilter)}>
            <option value="all">Tüm firmalar</option>
            <option value="ready">E-postası hazır</option>
            <option value="candidate">Gmail adayı var</option>
            <option value="missing">E-posta eksik</option>
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
                filtered.map((cari) => (
                  <tr key={cari.cari_kod}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{cari.firma_adi}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{cari.cari_kod}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <CariEmailStatus cari={cari} />
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
                        Önizle
                      </PreviewLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CariEmailStatus({ cari }: { cari: MutabakatCari }) {
  if (cari.email) {
    return (
      <div>
        <p className="font-medium text-slate-800">{cari.email_adresleri.join(', ')}</p>
        <p className="mt-1 text-xs text-emerald-700">
          {cari.email_kaynagi || 'Mikro cari kartı'} · gönderime hazır
        </p>
      </div>
    )
  }

  if (cari.email_adaylari.length > 0) {
    return (
      <div>
        <p className="text-slate-600">{cari.email_adaylari[0].email}</p>
        {cari.email_adaylari.length > 1 && (
          <p className="mt-0.5 text-xs text-slate-400">
            +{cari.email_adaylari.length - 1} aday daha
          </p>
        )}
        <p className="mt-1 text-xs text-amber-700">Gmail adayı · önizlemede düzenleyin</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-slate-500">—</p>
      <p className="mt-1 text-xs text-red-600">E-posta adresi bulunamadı</p>
    </div>
  )
}
