import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { getCari, loadSnapshot } from '@/lib/data'
import { buildMutabakatEmail, formatDate } from '@/lib/mutabakat'
import { createMutabakatToken } from '@/lib/mutabakat-token'
import { formatTL } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MutabakatPreviewPage({
  params,
}: {
  params: Promise<{ kod: string }>
}) {
  const { kod: encodedKod } = await params
  const cari = getCari(decodeURIComponent(encodedKod))
  if (!cari) notFound()

  const snapshot = loadSnapshot()
  const token = createMutabakatToken(cari.cari_kod, snapshot.snapshot_tarihi, cari.bakiye)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://kobi-tahsilat.vercel.app').replace(/\/$/, '')
  const email = buildMutabakatEmail(cari, snapshot.snapshot_tarihi, {
    itirazUrl: `${baseUrl}/mutabakat/itiraz/${encodeURIComponent(token)}`,
  })

  return (
    <div className="space-y-5">
      <Link
        href="/mutabakat"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <ArrowLeft size={16} />
        Mutabakat listesine dön
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="font-mono text-xs text-slate-400">{cari.cari_kod}</p>
            <h2 className="mt-1 text-xl font-semibold">{cari.firma_adi}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                Bakiye: {formatTL(cari.bakiye)}
              </span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                Gecikmiş: {formatTL(cari.gecikmis_bakiye)}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
                Dönem: {formatDate(email.mutabakatTarihi)}
              </span>
            </div>
          </div>

          <div className="min-w-72 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Mail size={17} className="mt-0.5 text-brand-600" />
              <div>
                <p className="text-xs text-slate-500">Alıcı</p>
                <p className="mt-0.5 font-medium">
                  {email.to.length ? email.to.join(', ') : 'E-posta adresi bulunamadı'}
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
              Konu: {email.subject}
            </p>
          </div>
        </div>

        {!cari.email && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            Bu firmanın Mikro cari kartında geçerli e-posta adresi bulunmuyor. Gönderimden önce
            adres eklenmelidir.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} />
            Önizleme güvenlidir; müşteriye henüz e-posta gönderilmez.
          </div>
          <button
            type="button"
            disabled
            title="Kontrol onayından sonra etkinleştirilecek"
            className="rounded-lg bg-slate-300 px-4 py-2 text-xs font-semibold text-slate-600"
          >
            Gönderim kapalı
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm">
        <div className="border-b border-slate-300 bg-white px-4 py-3">
          <p className="text-sm font-medium">Müşterinin göreceği e-posta</p>
          <p className="text-xs text-slate-500">Masaüstü ve mobil e-posta istemcileri için uyumlu HTML</p>
        </div>
        <iframe
          title={`${cari.firma_adi} mutabakat e-postası önizlemesi`}
          srcDoc={email.html}
          className="h-[900px] w-full bg-slate-100"
          sandbox="allow-top-navigation-by-user-activation"
        />
      </section>
    </div>
  )
}
