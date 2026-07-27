import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Bir cari için "yanlış" telefonu gizler (kaynak fark etmez, listeden düşer). */
export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { cariKod?: string; telefon?: string }
    const cariKod = String(body.cariKod || '').trim()
    const telefon = String(body.telefon || '').trim()
    if (!cariKod || !telefon) {
      return NextResponse.json({ success: false, error: 'cariKod ve telefon gerekli.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('cari_telefon_gizli')
      .upsert(
        { cari_kod: cariKod, telefon, gizleyen_user_id: user.id },
        { onConflict: 'cari_kod,telefon', ignoreDuplicates: true }
      )
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, message: `${telefon} gizlendi.` })
  } catch (cause) {
    console.error('[cari-telefon-gizle]', cause)
    const message = toErrorMessage(cause, 'Telefon gizlenemedi.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}
