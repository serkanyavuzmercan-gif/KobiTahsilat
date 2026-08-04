import { AlertTriangle, History, ShieldAlert, ShieldCheck } from 'lucide-react'
import { MfaKurulum } from '@/components/mfa-kurulum'
import { GirisGecmisTablo, SupheliUyari } from '@/components/giris-gecmis-tablo'
import { basarisizDenemeler, kendiGirisGecmisi } from '@/lib/giris-gecmis'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function GuvenlikPage() {
  const supabase = await createServerSupabaseClient()
  const [{ data: factors }, { data: userData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.getUser(),
  ])
  const kurulu = (factors?.all || []).some((f) => f.status === 'verified')
  const zorunlu = process.env.MFA_ZORUNLU === 'true'

  const user = userData?.user
  const [kendi, basarisiz] = await Promise.all([
    user ? kendiGirisGecmisi(user.email || '', user.id) : Promise.resolve([]),
    basarisizDenemeler(),
  ])

  const otuzGunOnce = Date.now() - 30 * 86400000
  const kendiBasarisiz = kendi.filter(
    (k) => !k.basarili && Date.parse(k.created_at) > otuzGunOnce
  ).length

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <ShieldCheck size={22} className="text-emerald-600" /> Hesap Güvenliği
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          İki adımlı doğrulama (2FA) açıkken, şifreniz ele geçse bile telefonunuzdaki kod olmadan
          hesabınıza girilemez. Aşağıda hesabınıza yapılan giriş denemelerini görebilirsiniz.
        </p>
      </section>

      {zorunlu && !kurulu && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Bu adım zorunludur</p>
              <p className="mt-1">
                Finans sisteminde iki adımlı doğrulama tüm personel için zorunlu tutulmuştur.
                Kurulumu tamamlamadan diğer ekranlara erişemezsiniz.
              </p>
            </div>
          </div>
        </section>
      )}

      <MfaKurulum kurulu={kurulu} />

      {/* Kendi giriş geçmişim */}
      <section className="card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <History size={18} className="text-brand-600" /> Hesabınıza son girişler
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Tanımadığınız bir giriş veya IP görürseniz şifrenizi değiştirin ve bilgi işleme bildirin.
        </p>
        <div className="mt-3 space-y-3">
          <SupheliUyari adet={kendiBasarisiz} />
          <GirisGecmisTablo kayitlar={kendi} bosMesaj="Henüz kayıt yok." />
        </div>
      </section>

      {/* Sistem geneli başarısız denemeler — saldırı izleme */}
      <section className="card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldAlert size={18} className="text-red-600" /> Sistemdeki başarısız denemeler
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Tüm hesaplar için son başarısız giriş denemeleri. Aynı IP&apos;den arka arkaya denemeler
          otomatik olarak 15 dakika engellenir.
        </p>
        <div className="mt-3">
          <GirisGecmisTablo
            kayitlar={basarisiz}
            kullaniciGoster
            bosMesaj="Başarısız deneme yok — temiz görünüyor."
          />
        </div>
      </section>
    </div>
  )
}
