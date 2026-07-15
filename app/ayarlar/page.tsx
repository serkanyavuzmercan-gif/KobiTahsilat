import { AutomationSettingsClient } from '@/components/automation-settings-client'
import { Settings2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function AyarlarPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Settings2 size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">Tahsilat ayarları</h2>
          <p className="text-xs text-slate-500">
            E-posta & WhatsApp bağlantıları, otomatik hatırlatma kuralları ve çalışma zamanı.
          </p>
        </div>
      </div>
      <AutomationSettingsClient />
    </div>
  )
}
