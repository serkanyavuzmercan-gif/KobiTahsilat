import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { assertAutomationReady } from '@/lib/automation/connections'
import { runAutomationForUser } from '@/lib/automation/runner'
import { toErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { dryRun?: boolean; force?: boolean }
    const dryRun = body.dryRun !== false
    const force = Boolean(body.force)

    if (!dryRun) {
      const readiness = await assertAutomationReady(user.id)
      if (readiness.issues.length) {
        return NextResponse.json(
          { success: false, error: readiness.issues.join(' ') },
          { status: 400 }
        )
      }
    }

    const result = await runAutomationForUser(user.id, { dryRun, force })

    return NextResponse.json({
      success: true,
      result,
      message: dryRun
        ? `${result.aday_sayisi} aday bulundu (taslak mod — gönderim yapılmadı).`
        : `${result.gonderilen} gönderim tamamlandı.`,
    })
  } catch (cause) {
    const message = toErrorMessage(cause, 'Otomasyon çalıştırılamadı.')
    const status = message.includes('Oturum') ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
