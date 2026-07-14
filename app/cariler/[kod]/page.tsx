import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCari, loadSnapshot } from '@/lib/data'
import { formatTL, formatNumber } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default function CariDetayPage({ params }: { params: { kod: string } }) {
  const kod = decodeURIComponent(params.kod)
  const cari = getCari(kod)
  if (!cari) notFound()

  const snap = loadSnapshot()
  const sira = snap.cariler.findIndex((c) => c.cari_kod === cari.cari_kod) + 1
  const pay = snap.toplam_alacak > 0 ? (cari.bakiye / snap.toplam_alacak) * 100 : 0

  return (
    <div className="space-y-4">
      <Link href="/cariler" className="text-sm text-brand-600 hover:underline">
        ← Carilere dön
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="font-mono text-xs text-slate-500">{cari.cari_kod}</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{cari.firma_adi}</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Açık bakiye" value={formatTL(cari.bakiye)} accent />
          <Info label="Ödeme vadesi" value={cari.odeme_vadesi || 'Belirtilmemiş'} />
          <Info label="Vade günü" value={cari.vade_gun != null ? `${cari.vade_gun} gün` : '—'} />
          <Info label="Sıra / pay" value={`#${sira} · %${pay.toFixed(1)}`} />
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Sonraki adımlar (plan)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Açık evrak kırılımı (ss `vade_takip_tahsilat` / FIFO)</li>
            <li>Vade yaşlandırma (0–30 / 31–60 / 61–90 / 90+)</li>
            <li>Tahsilat notu / arama kaydı</li>
            <li>Temsilci bilgisi</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Bakiye işareti ss ile aynı: <strong>pozitif = alacağımız</strong> (müşteri bize borçlu).
        Ham tutar: {formatNumber(cari.bakiye)} ₺
      </section>
    </div>
  )
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
