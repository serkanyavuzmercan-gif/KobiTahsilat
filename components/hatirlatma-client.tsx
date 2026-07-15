'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Eye, MessageCircle, Phone, PhoneOff, Search } from 'lucide-react'
import { PreviewLink } from '@/components/ui/button'
import { HatirlatmaPhoneStatus } from '@/components/hatirlatma-send-panel'
import {
  EmptyTableRow,
  FilterBar,
  FilterSelect,
  SearchInput,
  StatusBadge,
  SummaryStat,
} from '@/components/ui/summary-stat'
import { formatPhoneDisplay } from '@/lib/phone'
import type { HatirlatmaCari } from '@/lib/hatirlatma-data'
import { formatTL } from '@/lib/types'

export function HatirlatmaClient({
  cariler,
  snapshotTarihi,
  sendEnabled,
}: {
  cariler: HatirlatmaCari[]
  snapshotTarihi: string
  sendEnabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'ready' | 'candidate' | 'missing'>('all')

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return cariler.filter((cari) => {
      const phoneText = cari.telefon ? formatPhoneDisplay(cari.telefon).toLocaleLowerCase('tr') : ''
      const matchesSearch =
        !term ||
        cari.firma_adi.toLocaleLowerCase('tr').includes(term) ||
        cari.cari_kod.toLocaleLowerCase('tr').includes(term) ||
        phoneText.includes(term) ||
        cari.telefon_adaylari.some((aday) =>
          formatPhoneDisplay(aday.telefon).toLocaleLowerCase('tr').includes(term)
        )
      const matchesPhone =
        phoneFilter === 'all' ||
        (phoneFilter === 'ready' && Boolean(cari.telefon)) ||
        (phoneFilter === 'candidate' && !cari.telefon && cari.telefon_adaylari.length > 0) ||
        (phoneFilter === 'missing' && !cari.telefon && cari.telefon_adaylari.length === 0)
      return matchesSearch && matchesPhone
    })
  }, [cariler, phoneFilter, query])

  const ready = cariler.filter((cari) => cari.telefon).length
  const candidate = cariler.filter(
    (cari) => !cari.telefon && cari.telefon_adaylari.length > 0
  ).length
  const missing = cariler.length - ready - candidate

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">WhatsApp tahsilat hatırlatması</h2>
              <StatusBadge tone={sendEnabled ? 'ok' : 'warn'}>
                {sendEnabled ? 'Gönderim açık' : 'Gönderim kapalı'}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dönem: {snapshotTarihi} · Kibar ödeme hatırlatması (mutabakat değil). Telefon
              düzenleme yalnızca önizleme ekranında yapılır.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:max-w-xl">
            <SummaryStat icon={<CheckCircle2 size={18} />} label="Gönderime hazır" value={ready} tone="ok" />
            <SummaryStat icon={<Phone size={18} />} label="Telefon adayı" value={candidate} tone="candidate" />
            <SummaryStat icon={<PhoneOff size={18} />} label="Telefon eksik" value={missing} tone="missing" />
          </div>
        </div>

        <FilterBar
          resultText={`${filtered.length} firma listeleniyor${filtered.length !== cariler.length ? ` (${cariler.length} toplam)` : ''}`}
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Firma, cari kod veya telefon ara…"
            icon={<Search size={17} />}
          />
          <FilterSelect value={phoneFilter} onChange={(value) => setPhoneFilter(value as typeof phoneFilter)}>
            <option value="all">Tüm firmalar</option>
            <option value="ready">Telefonu hazır</option>
            <option value="candidate">Telefon adayı var</option>
            <option value="missing">Telefon eksik</option>
          </FilterSelect>
        </FilterBar>
      </section>

      <section className="table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
                <th className="px-4 py-3 text-right">Gecikmiş</th>
                <th className="px-4 py-3">Son WhatsApp</th>
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
                      <HatirlatmaPhoneStatus
                        telefon={cari.telefon}
                        telefonKaynagi={cari.telefon_kaynagi}
                        hasCandidate={cari.telefon_adaylari.length > 0}
                      />
                      {cari.telefon_adaylari[0] && !cari.telefon && (
                        <p className="mt-1 text-xs text-amber-700">
                          Aday: {formatPhoneDisplay(cari.telefon_adaylari[0].telefon)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatTL(cari.bakiye)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-red-700">
                      {formatTL(cari.gecikmis_bakiye)}
                    </td>
                    <td className="px-4 py-3">
                      {cari.whatsapp_son_gonderim ? (
                        <div className="flex items-start gap-2 text-slate-700">
                          <CalendarClock size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                          <div>
                            <p className="whitespace-nowrap font-medium">
                              {new Date(cari.whatsapp_son_gonderim).toLocaleDateString('tr-TR')}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(cari.whatsapp_son_gonderim).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {cari.whatsapp_gonderim_sayisi > 0
                                ? ` · ${cari.whatsapp_gonderim_sayisi} gönderim`
                                : ''}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Henüz gönderilmedi</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <PreviewLink href={`/hatirlatma/${encodeURIComponent(cari.cari_kod)}`}>
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

      <p className="text-xs text-slate-500">
        <MessageCircle size={14} className="mr-1 inline text-emerald-600" />
        WhatsApp gönderimi ss ile ortak Baileys ofis botu üzerinden yapılır: mesaj kuyruğa alınır,
        ofis PC&apos;sindeki bot sırayla gönderir (Meta Cloud API kullanılmaz).
      </p>
    </div>
  )
}
