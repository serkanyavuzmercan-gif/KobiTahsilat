import { notFound } from 'next/navigation'
import { BackLink } from '@/components/ui/button'
import { getCari, loadSnapshot } from '@/lib/data'
import { cariOrtalamaGecikmeGun, formatGecikmeGun } from '@/lib/gecikme'
import { AGING_BUCKETS, formatTL, formatNumber } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function CariDetayPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod: encodedKod } = await params
  const kod = decodeURIComponent(encodedKod)
  const cari = getCari(kod)
  if (!cari) notFound()

  const snap = loadSnapshot()
  const sira = snap.cariler.findIndex((c) => c.cari_kod === cari.cari_kod) + 1
  const pay = snap.toplam_alacak > 0 ? (cari.bakiye / snap.toplam_alacak) * 100 : 0
  const ortalamaGecikme = cariOrtalamaGecikmeGun(cari)

  return (
    <div className="space-y-4">
      <BackLink href="/cariler">Carilere dön</BackLink>

      <section className="card p-6">
        <p className="font-mono text-xs text-slate-500">{cari.cari_kod}</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{cari.firma_adi}</h2>
        <p className={`mt-1 text-sm ${cari.email ? 'text-slate-500' : 'text-red-600'}`}>
          {cari.email_adresleri.length
            ? `E-posta: ${cari.email_adresleri.join(', ')} · ${cari.email_kaynagi || 'Mikro cari kartı'}`
            : 'Mikro cari kartında e-posta adresi yok'}
        </p>
        {!cari.email && cari.email_adaylari.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <strong>Onay bekleyen Gmail adayları:</strong>{' '}
            {cari.email_adaylari.map((aday) => aday.email).join(', ')}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Açık bakiye" value={formatTL(cari.bakiye)} accent />
          <Info label="Vadesi geçmiş" value={formatTL(cari.gecikmis_bakiye)} warning />
          <Info
            label="Ortalama gecikme"
            value={formatGecikmeGun(ortalamaGecikme)}
            warning={ortalamaGecikme != null}
          />
          <Info label="Ödeme vadesi" value={cari.odeme_vadesi || 'Belirtilmemiş'} />
          <Info label="Vade günü" value={cari.vade_gun != null ? `${cari.vade_gun} gün` : '—'} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AGING_BUCKETS.map((bucket, index) => (
            <div
              key={bucket}
              className={`rounded-xl border p-3 ${
                index === 0
                  ? 'border-emerald-200 bg-emerald-50'
                  : index === 4
                    ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p className="text-xs text-slate-600">{bucket}</p>
              <p className="mt-1 font-semibold tabular-nums">{formatTL(cari.aging[bucket] || 0)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="table-shell">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-semibold">Açık faturalar / evraklar</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {cari.acik_kalemler.length} açık kalem · FIFO · Sıra #{sira} · Toplam pay %{pay.toFixed(1)}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Evrak</th>
                <th className="px-4 py-3">Evrak tarihi</th>
                <th className="px-4 py-3">Vade tarihi</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Temsilci</th>
                <th className="px-4 py-3 text-right">Açık tutar</th>
              </tr>
            </thead>
            <tbody>
              {cari.acik_kalemler.map((kalem, index) => (
                <tr
                  key={`${kalem.evrak_no}-${kalem.vade_tarihi}-${index}`}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{kalem.evrak_no || '—'}</p>
                    {kalem.belge_no && (
                      <p className="text-xs text-slate-400">Belge: {kalem.belge_no}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(kalem.evrak_tarihi)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(kalem.vade_tarihi)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        kalem.gecikme_gun > 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {kalem.gecikme_gun > 0
                        ? `${kalem.gecikme_gun} gün gecikmiş`
                        : kalem.gecikme_gun === 0
                          ? 'Bugün vadeli'
                          : `${Math.abs(kalem.gecikme_gun)} gün var`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{kalem.temsilci || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatTL(kalem.tutar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Kaynak: Mikro cari hareketleri. Vade önceliği: <strong>cha_vade → ödeme planı → evrak tarihi</strong>.
        Bakiye işareti ss ile aynı: pozitif = alacağımız. Ham tutar: {formatNumber(cari.bakiye)} ₺
      </section>
    </div>
  )
}

function Info({
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
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          accent ? 'text-brand-700' : warning ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR').format(new Date(`${value}T00:00:00Z`))
}
