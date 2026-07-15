import { AutomationSettingsClient } from '@/components/automation-settings-client'

export const dynamic = 'force-dynamic'

export default function AyarlarPage() {
  return (
    <div className="space-y-5">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">Tahsilat ayarları</h2>
        <p className="mt-1 text-sm text-slate-500">
          E-posta ve WhatsApp bağlantılarınızı yönetin; ortalama gecikme süresine göre otomatik
          hatırlatma kurallarını tanımlayın.
        </p>
      </section>
      <AutomationSettingsClient />
    </div>
  )
}
