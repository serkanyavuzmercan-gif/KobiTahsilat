import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Bir cari için "yanlış" e-postayı gizler (kaynak fark etmez, listeden düşer). */
export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { cariKod?: string; email?: string }
    const cariKod = String(body.cariKod || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    if (!cariKod || !email) {
      return NextResponse.json({ success: false, error: 'cariKod ve email gerekli.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('cari_email_gizli')
      .upsert(
        { cari_kod: cariKod, email, gizleyen_user_id: user.id },
        { onConflict: 'cari_kod,email', ignoreDuplicates: true }
      )
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, message: `${email} gizlendi.` })
  } catch (cause) {
    console.error('[cari-email-gizle]', cause)
    const message = toErrorMessage(cause, 'E-posta gizlenemedi.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}
