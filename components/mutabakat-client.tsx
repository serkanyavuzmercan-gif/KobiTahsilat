'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, Eye, Mail, MailWarning, Search } from 'lucide-react'
import { CariEmailEditor } from '@/components/cari-email-editor'
import type { MutabakatCari } from '@/lib/mutabakat-data'
import { formatTL } from '@/lib/types'

export function MutabakatClient({
  cariler,
  snapshotTarihi,
}: {
  cariler: MutabakatCari[]
  snapshotTarihi: string
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Bakiye mutabakatı</h2>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                Önizleme modu
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dönem: {snapshotTarihi} · Gerçek e-posta gönderimi kontrol onayına kadar kapalıdır.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Summary icon={<CheckCircle2 size={18} />} label="Gönderime hazır" value={ready} tone="ok" />
            <Summary icon={<Mail size={18} />} label="Onay bekleyen" value={candidate} tone="candidate" />
            <Summary icon={<MailWarning size={18} />} label="E-posta eksik" value={missing} tone="missing" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-brand-500">
            <Search size={17} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma, cari kod veya e-posta ara…"
              className="w-full py-2.5 text-sm outline-none"
            />
          </label>
          <select
            value={emailFilter}
            onChange={(event) => setEmailFilter(event.target.value as typeof emailFilter)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Tüm firmalar</option>
            <option value="ready">E-postası hazır</option>
            <option value="candidate">Gmail adayı var</option>
            <option value="missing">E-posta eksik</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
              {filtered.map((cari) => (
                <tr key={cari.cari_kod} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{cari.firma_adi}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{cari.cari_kod}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <CariEmailEditor
                      cariKod={cari.cari_kod}
                      initialEmails={cari.email_adresleri}
                      candidates={cari.email_adaylari}
                      compact
                    />
                    <p
                      className={`mt-1 text-xs ${
                        cari.email ? 'text-emerald-700' : cari.email_adaylari.length ? 'text-amber-700' : 'text-red-600'
                      }`}
                    >
                      {cari.email
                        ? `${cari.email_kaynagi || 'Mikro cari kartı'} · gönderime hazır`
                        : cari.email_adaylari.length
                          ? 'Gmail adayı var · seçip kaydedin'
                          : 'E-posta adresi bulunamadı'}
                    </p>
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
                                {new Date(
                                  cari.mutabakat_tekrar_gonderilebilir_at
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
                      href={`/mutabakat/${encodeURIComponent(cari.cari_kod)}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
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
