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
          <h2 className="text-base font-semibold leading-tight">Otomasyon Ayarları</h2>
          <p className="text-xs text-slate-500">
            Otomatik mutabakat ve otomatik ödeme talebi — her biri bağımsız aç/kapa.
          </p>
        </div>
      </div>
      <AutomationSettingsClient />
    </div>
  )
}
