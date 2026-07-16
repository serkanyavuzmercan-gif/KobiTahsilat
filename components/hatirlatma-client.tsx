'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Mail,
  MessageCircle,
  Phone,
  Search,
} from 'lucide-react'
import { PreviewLink } from '@/components/ui/button'
import { OdemeTalepActions } from '@/components/odeme-talep-actions'
import {
  EmptyTableRow,
  FilterBar,
  SearchInput,
  StatusBadge,
  SummaryStat,
} from '@/components/ui/summary-stat'
import { cariOrtalamaGecikmeGun } from '@/lib/gecikme'
import { formatPhoneDisplay } from '@/lib/phone'
import type { HatirlatmaCari } from '@/lib/hatirlatma-data'
import { formatTL } from '@/lib/types'

const VARSAYILAN_ESIK = 20
// Küçük tutarlı gecikmeler (ör. 1 TL kuruş farkları) listede gürültü yapıyor; alt eşik.
const MIN_GECIKMIS_TUTAR = 1000

export function HatirlatmaClient({
  cariler,
  snapshotTarihi,
  sendEnabled,
  pdfUrls,
  etiketler,
}: {
  cariler: HatirlatmaCari[]
  snapshotTarihi: string
  sendEnabled: boolean
  pdfUrls: Record<string, string>
  etiketler?: Record<string, { telefon: Record<string, string>; email: Record<string, string> }>
}) {
  const [query, setQuery] = useState('')
  const [esik, setEsik] = useState(VARSAYILAN_ESIK)

  // Her firma için tutar-ağırlıklı ortalama gecikme günü (bir kez hesapla).
  const zenginCariler = useMemo(
    () =>
      cariler.map((cari) => ({
        cari,
        ortalamaGecikme: cariOrtalamaGecikmeGun(cari),
      })),
    [cariler]
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    const esikNum = Number.isFinite(esik) ? esik : 0
    return zenginCariler
      .filter(({ cari, ortalamaGecikme }) => {
        // Ödeme talebi yalnızca vadesi geçmiş + eşik günü aşmış + tutar anlamlı firmalara.
        if (cari.gecikmis_bakiye < MIN_GECIKMIS_TUTAR) return false
        if (ortalamaGecikme == null || ortalamaGecikme < esikNum) return false
        if (!term) return true
        const phoneText = cari.telefon
          ? formatPhoneDisplay(cari.telefon).toLocaleLowerCase('tr')
          : ''
        return (
          cari.firma_adi.toLocaleLowerCase('tr').includes(term) ||
          cari.cari_kod.toLocaleLowerCase('tr').includes(term) ||
          phoneText.includes(term)
        )
      })
      .sort((a, b) => (b.ortalamaGecikme || 0) - (a.ortalamaGecikme || 0))
  }, [zenginCariler, esik, query])

  const toplamGecikmis = filtered.reduce((sum, { cari }) => sum + cari.gecikmis_bakiye, 0)
  const kanalHazir = filtered.filter(
    ({ cari }) => cari.telefon || cari.email_adresleri.length
  ).length

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Ödeme Talebi Gönder</h2>
              <StatusBadge tone={sendEnabled ? 'ok' : 'warn'}>
                {sendEnabled ? 'Gönderim açık' : 'Gönderim kapalı'}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dönem: {snapshotTarihi} · Ortalama vadesi{' '}
              <strong className="text-slate-700">{esik} gün</strong> ve üzeri gecikmiş firmalara
              WhatsApp, e-posta veya her ikisiyle ödeme talebi gönderin.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:max-w-xl">
            <SummaryStat
              icon={<AlertTriangle size={18} />}
              label={`Eşik (≥${esik}g) firma`}
              value={filtered.length}
              tone="missing"
            />
            <SummaryStat
              icon={<CalendarClock size={18} />}
              label="Toplam gecikmiş"
              value={formatTL(toplamGecikmis)}
              tone="candidate"
            />
            <SummaryStat
              icon={<MessageCircle size={18} />}
              label="Kanalı hazır"
              value={kanalHazir}
              tone="ok"
            />
          </div>
        </div>

        <FilterBar
          resultText={`${filtered.length} firma · ortalama gecikme ≥ ${esik} gün · gecikmiş ≥ ${formatTL(MIN_GECIKMIS_TUTAR)}`}
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Firma, cari kod veya telefon ara…"
            icon={<Search size={17} />}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Ortalama gecikme eşiği (gün)</span>
            <input
              type="number"
              min={0}
              max={365}
              value={Number.isFinite(esik) ? esik : ''}
              onChange={(event) => {
                const value = Number(event.target.value)
                setEsik(Number.isFinite(value) && value >= 0 ? value : 0)
              }}
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
        </FilterBar>
      </section>

      <section className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-3">Firma</th>
                <th className="px-3 py-3 text-right">Ort. gecikme</th>
                <th className="px-3 py-3 text-right">Gecikmiş</th>
                <th className="px-3 py-3">Son gönderim</th>
                <th className="px-3 py-3 text-right">Ödeme talebi gönder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyTableRow
                  colSpan={5}
                  message={`Ortalama gecikmesi ${esik} gün ve üzeri firma bulunamadı. Eşiği düşürerek daha fazla firma listeleyebilirsiniz.`}
                />
              ) : (
                filtered.map(({ cari, ortalamaGecikme }) => (
                  <tr key={cari.cari_kod}>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium leading-tight">{cari.firma_adi}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{cari.cari_kod}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          title={cari.telefon ? formatPhoneDisplay(cari.telefon) : 'Telefon yok'}
                          className="inline-flex items-center gap-1 text-[11px]"
                        >
                          <Phone
                            size={12}
                            className={cari.telefon ? 'text-emerald-600' : 'text-slate-300'}
                          />
                          <span className={cari.telefon ? 'text-slate-600' : 'text-slate-400'}>
                            {cari.telefon ? 'Tel var' : 'Tel yok'}
                          </span>
                        </span>
                        <span
                          title={cari.email_adresleri[0] || 'E-posta yok'}
                          className="inline-flex items-center gap-1 text-[11px]"
                        >
                          <Mail
                            size={12}
                            className={
                              cari.email_adresleri.length ? 'text-brand-600' : 'text-slate-300'
                            }
                          />
                          <span
                            className={
                              cari.email_adresleri.length ? 'text-slate-600' : 'text-slate-400'
                            }
                          >
                            {cari.email_adresleri.length ? 'E-posta var' : 'E-posta yok'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <span className="inline-block rounded-full bg-red-50 px-2.5 py-1 font-semibold tabular-nums text-red-700">
                        {ortalamaGecikme != null ? `${ortalamaGecikme} gün` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-top font-medium tabular-nums text-red-700">
                      {formatTL(cari.gecikmis_bakiye)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <SonGonderim
                        whatsapp={cari.whatsapp_son_gonderim}
                        email={cari.email_son_gonderim}
                      />
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <OdemeTalepActions
                        cari={cari}
                        snapshotTarihi={snapshotTarihi}
                        pdfUrl={pdfUrls[cari.cari_kod] || ''}
                        sendEnabled={sendEnabled}
                        telefonEtiket={etiketler?.[cari.cari_kod]?.telefon}
                        emailEtiket={etiketler?.[cari.cari_kod]?.email}
                      />
                      <div className="mt-1.5">
                        <PreviewLink href={`/hatirlatma/${encodeURIComponent(cari.cari_kod)}`}>
                          <Eye size={13} />
                          Önizle / düzenle
                        </PreviewLink>
                      </div>
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
        WhatsApp gönderimi ss ile ortak Baileys ofis botu üzerinden yapılır (Meta Cloud API
        kullanılmaz); e-posta ise kurumsal Gmail kutusundan gider. Mesaj metni her iki kanalda da
        önceden belirlenmiş ödeme talebidir.
      </p>
    </div>
  )
}

function SonGonderim({
  whatsapp,
  email,
}: {
  whatsapp: string | null
  email: string | null
}) {
  if (!whatsapp && !email) {
    return <span className="text-xs text-slate-400">Henüz gönderilmedi</span>
  }
  return (
    <div className="space-y-1 text-xs">
      {whatsapp && (
        <div className="flex items-center gap-1.5 text-slate-700">
          <MessageCircle size={13} className="text-emerald-600" />
          <span>{new Date(whatsapp).toLocaleDateString('tr-TR')}</span>
        </div>
      )}
      {email && (
        <div className="flex items-center gap-1.5 text-slate-700">
          <Mail size={13} className="text-brand-600" />
          <span>{new Date(email).toLocaleDateString('tr-TR')}</span>
        </div>
      )}
    </div>
  )
}
