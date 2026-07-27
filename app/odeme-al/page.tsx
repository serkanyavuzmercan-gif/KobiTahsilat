import { CreditCard } from 'lucide-react'
import { loadSnapshot } from '@/lib/data'
import { paytrYapili } from '@/lib/paytr'
import { OdemeAlClient } from '@/components/odeme-al-client'

export const dynamic = 'force-dynamic'

export default async function OdemeAlPage() {
  const snap = await loadSnapshot()
  const yapili = paytrYapili()
  const cariler = snap.cariler
    .filter((c) => c.bakiye > 0.01)
    .map((c) => ({
      cari_kod: c.cari_kod,
      firma_adi: c.firma_adi,
      bakiye: c.bakiye,
      gecikmis_bakiye: c.gecikmis_bakiye,
    }))
    .sort((a, b) => b.gecikmis_bakiye - a.gecikmis_bakiye)

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <CreditCard size={22} className="text-sky-600" /> Ödeme Al
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Cari seç, tutarı gör/düzenle, tek tıkla <strong>güvenli ödeme linki</strong> üret. Kart bilgisi
          bize hiç değmez — müşteri PayTR sayfasında öder. Linki kopyalayıp gönderebilirsin.
        </p>
      </section>

      {!yapili && (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>PayTR henüz bağlı değil.</strong> Ödeme linki üretmek için merchant anahtarları
          (PAYTR_MERCHANT_ID / KEY / SALT) tanımlanmalı. Anahtarlar girildiğinde bu ekran çalışır.
        </section>
      )}

      <OdemeAlClient cariler={cariler} yapili={yapili} />
    </div>
  )
}
