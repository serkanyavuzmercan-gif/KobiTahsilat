import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { loadAutomationConnectionsStatus } from '@/lib/automation/connections'
import { createDefaultAutomationSettings } from '@/lib/automation/defaults'
import {
  loadAutomationSettings,
  saveAutomationSettings,
  validateAutomationSettingsInput,
} from '@/lib/automation/settings'
import type { AutomationSettings } from '@/lib/automation/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuthUser()
    const [settings, connections] = await Promise.all([
      loadAutomationSettings(user.id),
      loadAutomationConnectionsStatus(user.id),
    ])

    return NextResponse.json({
      success: true,
      settings,
      connections,
      defaults: createDefaultAutomationSettings(),
    })
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'Ayarlar yüklenemedi.') },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as Partial<AutomationSettings>
    const current = await loadAutomationSettings(user.id)

    const next: AutomationSettings = {
      ...current,
      ...body,
      version: 2,
      mutabakat: { ...current.mutabakat, ...(body.mutabakat || {}) },
      odeme_talebi: { ...current.odeme_talebi, ...(body.odeme_talebi || {}) },
      updated_at: new Date().toISOString(),
    }

    validateAutomationSettingsInput(next)
    const saved = await saveAutomationSettings(user.id, next)

    return NextResponse.json({
      success: true,
      settings: saved,
      message: 'Otomasyon ayarları kaydedildi.',
    })
  } catch (cause) {
    const message = toErrorMessage(cause, 'Ayarlar kaydedilemedi.')
    const status = message.includes('Oturum') ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
