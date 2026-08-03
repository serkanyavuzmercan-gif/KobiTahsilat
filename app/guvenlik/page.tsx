import { ShieldCheck } from 'lucide-react'
import { MfaKurulum } from '@/components/mfa-kurulum'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function GuvenlikPage() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const kurulu = (data?.all || []).some((f) => f.status === 'verified')

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <ShieldCheck size={22} className="text-emerald-600" /> Hesap Güvenliği
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          İki adımlı doğrulama (2FA) açıkken, şifreniz ele geçse bile telefonunuzdaki kod olmadan
          hesabınıza girilemez. Finans verilerine erişim için önerilir.
        </p>
      </section>

      <MfaKurulum kurulu={kurulu} />
    </div>
  )
}
