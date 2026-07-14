import { loadSnapshot } from '@/lib/data'
import { formatTL, formatNumber } from '@/lib/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const snap = loadSnapshot()
  const top = snap.cariler.slice(0, 10)
  const ort = snap.cari_sayisi ? snap.toplam_alacak / snap.cari_sayisi : 0

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Açık tahsilat özeti</h2>
        <p className="mt-1 text-sm text-slate-500">
          Kaynak: {snap.source} · Güncellendi:{' '}
          {new Date(snap.sourced_at).toLocaleString('tr-TR')}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat label="Toplam alacak" value={formatTL(snap.toplam_alacak)} accent />
          <Stat label="Açık cari sayısı" value={String(snap.cari_sayisi)} />
          <Stat label="Ortalama bakiye" value={formatTL(ort)} />
        </div>
        <p className="mt-4 text-xs text-slate-500">{snap.note}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">En yüksek bakiyeler</h3>
          <Link href="/cariler" className="text-sm font-medium text-brand-600 hover:underline">
            Tüm cariler →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Cari kod</th>
                <th className="px-2 py-2">Firma</th>
                <th className="px-2 py-2">Vade</th>
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
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {formatNumber(c.bakiye)}
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? 'text-brand-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
