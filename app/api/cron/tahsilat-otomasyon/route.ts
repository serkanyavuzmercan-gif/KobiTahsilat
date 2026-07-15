import { NextResponse } from 'next/server'
import { automationGloballyEnabled } from '@/lib/automation/settings'
import { runAutomationForAllUsers } from '@/lib/automation/runner'
import { toErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  const header = request.headers.get('x-cron-secret')
  return header === secret
}

export async function GET(request: Request) {
  try {
    if (!authorizeCron(request)) {
      return NextResponse.json({ success: false, error: 'Yetkisiz cron isteği.' }, { status: 401 })
    }

    if (!automationGloballyEnabled()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'OTOMATIK_TAHSILAT_ENABLED kapalı; cron atlandı.',
        results: [],
      })
    }

    const results = await runAutomationForAllUsers({ dryRun: false })

    return NextResponse.json({
      success: true,
      message: `${results.length} kullanıcı için otomasyon çalıştırıldı.`,
      results,
    })
  } catch (cause) {
    console.error('[cron-tahsilat-otomasyon]', cause)
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'Cron otomasyonu başarısız.') },
      { status: 500 }
    )
  }
}
