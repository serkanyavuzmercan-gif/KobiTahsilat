import { notFound } from 'next/navigation'
import { CheckCircle2, History, Mail, MessageCircle, Phone, Reply, Send, Users } from 'lucide-react'
import { BackLink } from '@/components/ui/button'
import { CariKisilerEditor } from '@/components/cari-kisiler-editor'
import { loadCariKisiler } from '@/lib/cari-kisiler'
import { loadCariGecmis } from '@/lib/cari-gecmis'
import { getCari, loadSnapshot } from '@/lib/data'
import { cariOrtalamaGecikmeGun, formatGecikmeGun } from '@/lib/gecikme'
import { formatPhoneDisplay } from '@/lib/phone'
import { AGING_BUCKETS, formatTL, formatNumber } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function CariDetayPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod: encodedKod } = await params
  const kod = decodeURIComponent(encodedKod)
  const cari = await getCari(kod)
  if (!cari) notFound()

  const snap = await loadSnapshot()
  const kisiler = await loadCariKisiler(cari.cari_kod)
  const gecmis = await loadCariGecmis(cari.cari_kod)
  const sira = snap.cariler.findIndex((c) => c.cari_kod === cari.cari_kod) + 1
  const pay = snap.toplam_alacak > 0 ? (cari.bakiye / snap.toplam_alacak) * 100 : 0
  const ortalamaGecikme = cariOrtalamaGecikmeGun(cari)

  return (
    <div className="space-y-4">
      <BackLink href="/cariler">Carilere dön</BackLink>

      <section className="card p-6">
        <p className="font-mono text-xs text-slate-500">{cari.cari_kod}</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{cari.firma_adi}</h2>
        {/* Bu cariye tanımlı iletişim bilgileri (tüm kaynaklardan birleşik) */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Mail size={13} className="text-brand-600" /> E-posta ({cari.email_adresleri.length})
            </p>
            {cari.email_adresleri.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {cari.email_adresleri.map((email, i) => (
                  <li key={email} className="text-sm text-slate-700">
                    {email}
                    {i === 0 && (
                      <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                        varsayılan
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-red-600">Tanımlı e-posta yok</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Phone size={13} className="text-emerald-600" /> Telefon ({cari.telefon_numaralari.length})
            </p>
            {cari.telefon_numaralari.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {cari.telefon_numaralari.map((tel, i) => (
                  <li key={tel} className="text-sm text-slate-700">
                    {formatPhoneDisplay(tel)}
                    {i === 0 && (
                      <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        varsayılan
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-red-600">Tanımlı telefon yok</p>
            )}
          </div>
        </div>
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

      <section className="card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Users size={18} className="text-brand-600" /> İletişim Kişileri
          <span className="text-xs font-normal text-slate-400">({kisiler.length})</span>
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Mikro yetkilileri + web/teklif kayıtları. Numara/e-posta yanındaki açıklamayı düzenleyebilir,
          kişi ekleyip silebilirsiniz — değişiklik kalıcıdır.
        </p>
        <div className="mt-3">
          <CariKisilerEditor cariKod={cari.cari_kod} kisiler={kisiler} />
        </div>
      </section>

      <section className="card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <History size={18} className="text-brand-600" /> Gönderim geçmişi &amp; yanıtlar
          <span className="text-xs font-normal text-slate-400">({gecmis.length})</span>
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Bu cariye gönderilen mutabakat / ödeme talepleri ve müşteriden gelen onay / itiraz / yanıtlar.
        </p>
        {gecmis.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Henüz gönderim veya yanıt kaydı yok.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {gecmis.map((k) => {
              const yanit = k.yon === 'yanit'
              const Icon = k.onay
                ? CheckCircle2
                : yanit
                  ? Reply
                  : k.kanal === 'WhatsApp'
                    ? MessageCircle
                    : Send
              return (
                <li
                  key={k.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    k.onay
                      ? 'border-emerald-200 bg-emerald-50'
                      : yanit
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Icon
                    size={17}
                    className={`mt-0.5 shrink-0 ${
                      k.onay ? 'text-emerald-600' : yanit ? 'text-amber-600' : 'text-brand-600'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-slate-800">{k.baslik}</span>
                      {k.kanal && (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                          {k.kanal}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          yanit ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
                        }`}
                      >
                        {yanit ? 'Gelen' : 'Giden'}
                      </span>
                    </div>
                    {k.metin && (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-slate-600">
                        {k.metin}
                      </p>
                    )}
                    {k.kisi && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {yanit ? 'İletişim: ' : 'Alıcı: '}
                        {k.kisi}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                    {k.tarih ? new Date(k.tarih).toLocaleString('tr-TR') : ''}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
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
