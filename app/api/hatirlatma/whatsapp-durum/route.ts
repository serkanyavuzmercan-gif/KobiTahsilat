import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { getKuyrukDurum } from '@/lib/whatsapp-kuyruk'

export const dynamic = 'force-dynamic'

/** UI, gönderim sonrası kuyruk id'lerinin durumunu buradan yoklar (bekliyor→gonderildi/hata). */
export async function GET(request: Request) {
  try {
    await requireAuthUser()
    const { searchParams } = new URL(request.url)
    const ids = (searchParams.get('ids') || searchParams.get('id') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    if (!ids.length) {
      return NextResponse.json({ success: false, error: 'Kuyruk id gerekli.' }, { status: 400 })
    }

    const durumMap = await getKuyrukDurum(ids)
    const durumlar = ids.map((id) => {
      const kayit = durumMap.get(id)
      return {
        id,
        durum: kayit?.durum ?? 'bilinmiyor',
        gonderildi_at: kayit?.gonderildi_at ?? null,
        hata: kayit?.hata ?? null,
        deneme: kayit?.deneme ?? 0,
      }
    })

    return NextResponse.json({ success: true, durumlar })
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: toErrorMessage(cause, 'Durum okunamadı.') },
      { status: 500 }
    )
  }
}
