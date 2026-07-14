'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Mail, MailWarning, Search } from 'lucide-react'
import type { CariBakiye } from '@/lib/types'
import { formatTL } from '@/lib/types'

export function MutabakatClient({
  cariler,
  snapshotTarihi,
}: {
  cariler: CariBakiye[]
  snapshotTarihi: string
}) {
  const [query, setQuery] = useState('')
  const [emailFilter, setEmailFilter] = useState<'all' | 'ready' | 'missing'>('all')

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return cariler.filter((cari) => {
      const matchesSearch =
        !term ||
        cari.firma_adi.toLocaleLowerCase('tr').includes(term) ||
        cari.cari_kod.toLocaleLowerCase('tr').includes(term) ||
        cari.email_adresleri.some((email) => email.includes(term))
      const matchesEmail =
        emailFilter === 'all' ||
        (emailFilter === 'ready' && Boolean(cari.email)) ||
        (emailFilter === 'missing' && !cari.email)
      return matchesSearch && matchesEmail
    })
  }, [cariler, emailFilter, query])

  const ready = cariler.filter((cari) => cari.email).length
  const missing = cariler.length - ready

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
          <div className="grid grid-cols-2 gap-3">
            <Summary icon={<CheckCircle2 size={18} />} label="E-postası hazır" value={ready} ok />
            <Summary icon={<MailWarning size={18} />} label="E-posta eksik" value={missing} />
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
            <option value="missing">E-posta eksik</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">E-posta</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
                <th className="px-4 py-3 text-right">Gecikmiş</th>
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
                  <td className="px-4 py-3">
                    {cari.email ? (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail size={15} className="text-emerald-600" />
                        <span>{cari.email_adresleri.join(', ')}</span>
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                        Mikro'da e-posta yok
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatTL(cari.bakiye)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-red-700">
                    {formatTL(cari.gecikmis_bakiye)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/mutabakat/${encodeURIComponent(cari.cari_kod)}`}
                      className="inline-flex rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      E-postayı önizle
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
  ok,
}: {
  icon: React.ReactNode
  label: string
  value: number
  ok?: boolean
}) {
  return (
    <div
      className={`min-w-36 rounded-xl border px-4 py-3 ${
        ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className={`flex items-center gap-2 ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
