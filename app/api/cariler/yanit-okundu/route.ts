import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { markYanitlarOkundu } from '@/lib/cari-yanitlar'
import { toErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { yanitIds?: string[] }
    const yanitIds = Array.isArray(body.yanitIds) ? body.yanitIds.map(String) : []
    if (!yanitIds.length) {
      return NextResponse.json({ success: false, error: 'Yanıt kimliği gerekli.' }, { status: 400 })
    }

    await markYanitlarOkundu(user.id, yanitIds)
    return NextResponse.json({ success: true, message: 'Yanıtlar okundu olarak işaretlendi.' })
  } catch (cause) {
    const message = toErrorMessage(cause, 'Yanıt güncellenemedi.')
    const status = message.includes('Oturum') ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
