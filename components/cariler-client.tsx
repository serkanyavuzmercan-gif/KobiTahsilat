'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Açık tahsilat carileri</h2>
        <p className="mt-1 text-sm text-slate-500">
          {cariler.length} cari · Toplam {formatNumber(toplam)} ₺ · Snapshot:{' '}
          {new Date(sourcedAt).toLocaleString('tr-TR')}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Firma adı veya cari kod ara…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            value={minBakiye}
            onChange={(e) => setMinBakiye(e.target.value)}
            placeholder="Min. bakiye"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 sm:w-40"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Filtre sonucu: {filtered.length} cari · {formatNumber(filtToplam)} ₺
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Cari kod</th>
                <th className="px-3 py-3">Firma</th>
                <th className="px-3 py-3">Ödeme vadesi</th>
                <th className="px-3 py-3 text-right">Gecikmiş</th>
                <th className="px-3 py-3 text-right">Bakiye (₺)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.cari_kod} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.cari_kod}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/cariler/${encodeURIComponent(c.cari_kod)}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {c.firma_adi}
                    </Link>
                    <p
                      className={`mt-0.5 text-xs ${
                        c.email ? 'text-slate-500' : c.email_adaylari.length ? 'text-amber-600' : 'text-red-500'
                      }`}
                    >
                      {c.email_adresleri.length
                        ? c.email_adresleri.join(', ')
                        : c.email_adaylari.length
                          ? `Gmail adayı: ${c.email_adaylari[0].email}`
                          : 'E-posta adresi yok'}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.odeme_vadesi || '—'}
                    {c.vade_gun != null ? (
                      <span className="ml-1 text-xs text-slate-400">({c.vade_gun}g)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-red-700">
                    {formatNumber(c.gecikmis_bakiye)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                    {formatNumber(c.bakiye)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Eşleşen cari yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
