import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { MfaKurulum } from '@/components/mfa-kurulum'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function GuvenlikPage() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const kurulu = (data?.all || []).some((f) => f.status === 'verified')
  const zorunlu = process.env.MFA_ZORUNLU === 'true'

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <ShieldCheck size={22} className="text-emerald-600" /> Hesap Güvenliği
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          İki adımlı doğrulama (2FA) açıkken, şifreniz ele geçse bile telefonunuzdaki kod olmadan
          hesabınıza girilemez.
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
    </div>
  )
}
