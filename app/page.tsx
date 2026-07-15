import { loadSnapshot } from '@/lib/data'
import {
  cariOrtalamaGecikmeGun,
  formatGecikmeGun,
  portfoyOrtalamaGecikmeGun,
} from '@/lib/gecikme'
import { AGING_BUCKETS, formatTL, formatNumber } from '@/lib/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const snap = await loadSnapshot()
  const top = snap.cariler.slice(0, 10)
  const ort = snap.cari_sayisi ? snap.toplam_alacak / snap.cari_sayisi : 0
  const ortalamaGecikme = portfoyOrtalamaGecikmeGun(snap.cariler)

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">Açık tahsilat özeti</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kaynak: {snap.source} · Güncellendi:{' '}
          {new Date(snap.sourced_at).toLocaleString('tr-TR')}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Toplam alacak" value={formatTL(snap.toplam_alacak)} accent />
          <Stat label="Vadesi geçmiş" value={formatTL(snap.toplam_gecikmis)} warning />
          <Stat label="Açık cari sayısı" value={String(snap.cari_sayisi)} />
          <Stat label="Ortalama bakiye" value={formatTL(ort)} />
        </div>
        <p className="mt-4 text-xs text-slate-500">{snap.note}</p>
      </section>

      <section className="card p-6">
        <h3 className="text-lg font-semibold">Vade yaşlandırması</h3>
        <p className="mt-1 text-sm text-slate-500">
          Açık faturalar FIFO ile eşleştirilmiştir. Snapshot: {snap.snapshot_tarihi}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AGING_BUCKETS.map((bucket, index) => {
            const amount = snap.aging[bucket] || 0
            const percent = snap.toplam_alacak ? (amount / snap.toplam_alacak) * 100 : 0
            return (
              <div
                key={bucket}
                className={`rounded-xl border p-4 ${
                  index === 0
                    ? 'border-emerald-200 bg-emerald-50'
                    : index === 4
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p className="text-xs font-medium text-slate-600">{bucket}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">{formatTL(amount)}</p>
                <p className="mt-1 text-xs text-slate-500">%{percent.toFixed(1)}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">En yüksek bakiyeler</h3>
          <Link href="/cariler" className="text-sm font-medium text-brand-600 hover:underline">
            Tüm cariler →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Cari kod</th>
                <th className="px-2 py-2">Firma</th>
                <th className="px-2 py-2">Vade</th>
                <th className="px-2 py-2 text-right">Ort. gecikme</th>
                <th className="px-2 py-2 text-right">Gecikmiş</th>
                <th className="px-2 py-2 text-right">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c) => (
                <tr key={c.cari_kod} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-2 font-mono text-xs text-slate-600">{c.cari_kod}</td>
                  <td className="px-2 py-2">
                    <Link href={`/cariler/${encodeURIComponent(c.cari_kod)}`} className="font-medium hover:text-brand-700">
                      {c.firma_adi}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-slate-600">{c.odeme_vadesi || '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                    {formatGecikmeGun(cariOrtalamaGecikmeGun(c))}
                  </td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums text-red-700">
                    {formatNumber(c.gecikmis_bakiye)}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {formatNumber(c.bakiye)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
              <tr>
                <td colSpan={3} className="px-2 py-3 text-right font-medium text-slate-600">
                  Ortalama gecikme süresi
                </td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums text-red-700">
                  {formatGecikmeGun(ortalamaGecikme)}
                </td>
                <td colSpan={2} className="px-2 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Ortalama gecikme, vadesi geçmiş açık kalemler üzerinden tutar ağırlıklı hesaplanır.
        </p>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  warning,
}: {
  label: string
  value: string
  accent?: boolean
  warning?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? 'border-brand-200 bg-brand-50'
          : warning
            ? 'border-red-200 bg-red-50'
            : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? 'text-brand-700' : warning ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
