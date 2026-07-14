'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, Eye, MessageCircle, Phone, PhoneOff, Search } from 'lucide-react'
import { HatirlatmaPhoneStatus } from '@/components/hatirlatma-send-panel'
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">WhatsApp tahsilat hatırlatması</h2>
              {sendEnabled ? (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                  Gönderim açık
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                  Gönderim kapalı
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dönem: {snapshotTarihi} · Kibar ödeme hatırlatması (mutabakat değil). Telefon
              düzenleme yalnızca önizleme ekranında yapılır.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Summary icon={<CheckCircle2 size={18} />} label="Gönderime hazır" value={ready} tone="ok" />
            <Summary icon={<Phone size={18} />} label="Telefon adayı" value={candidate} tone="candidate" />
            <Summary icon={<PhoneOff size={18} />} label="Telefon eksik" value={missing} tone="missing" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-brand-500">
            <Search size={17} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma, cari kod veya telefon ara…"
              className="w-full py-2.5 text-sm outline-none"
            />
          </label>
          <select
            value={phoneFilter}
            onChange={(event) => setPhoneFilter(event.target.value as typeof phoneFilter)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Tüm firmalar</option>
            <option value="ready">Telefonu hazır</option>
            <option value="candidate">Telefon adayı var</option>
            <option value="missing">Telefon eksik</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
              {filtered.map((cari) => (
                <tr key={cari.cari_kod} className="border-t border-slate-100 hover:bg-slate-50">
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
                          {cari.whatsapp_gonderim_engelli &&
                            cari.whatsapp_tekrar_gonderilebilir_at && (
                              <p className="mt-1 max-w-36 text-xs font-medium text-amber-700">
                                Bekleme süresi ·{' '}
                                {new Date(
                                  cari.whatsapp_tekrar_gonderilebilir_at
                                ).toLocaleDateString('tr-TR')}
                              </p>
                            )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Henüz gönderilmedi</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link
                      href={`/hatirlatma/${encodeURIComponent(cari.cari_kod)}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <Eye size={15} />
                      Önizle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        <MessageCircle size={14} className="mr-1 inline" />
        WhatsApp gönderimi Meta Cloud API üzerinden yapılır. Canlı gönderim için işletme hesabı ve
        onaylı numara gerekir.
      </p>
    </div>
  )
}

function Summary({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'ok' | 'candidate' | 'missing'
}) {
  const styles = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    candidate: 'border-amber-200 bg-amber-50 text-amber-700',
    missing: 'border-red-200 bg-red-50 text-red-700',
  }[tone]
  return (
    <div className={`min-w-32 rounded-xl border px-3 py-3 ${styles}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
