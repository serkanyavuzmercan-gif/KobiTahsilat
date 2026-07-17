import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Kişi ekle/güncelle (kalıcı → cari_kisiler). id varsa güncelle, yoksa ekle. */
export async function POST(request: Request) {
  try {
    await requireAuthUser()
    const body = (await request.json()) as {
      id?: string
      cariKod?: string
      ad_soyad?: string
      unvan?: string
      telefon?: string
      email?: string
    }
    const telefon = String(body.telefon || '').trim() || null
    const email = String(body.email || '').trim().toLowerCase() || null
    // Ad soyad zorunlu DEĞİL: sadece e-posta veya sadece telefon eklemeye izin ver.
    // Hiçbiri yoksa hata. Ad soyad boşsa '—' varsayılır (kanal-only kayıt).
    const adSoyad = String(body.ad_soyad || '').trim() || '—'
    if (adSoyad === '—' && !telefon && !email) {
      return NextResponse.json(
        { success: false, error: 'En az bir e-posta, telefon veya ad soyad girin.' },
        { status: 400 }
      )
    }
    const payload = {
      ad_soyad: adSoyad,
      unvan: String(body.unvan || '').trim() || null,
      telefon,
      email,
    }

    const admin = createAdminClient()

    if (body.id) {
      const { error } = await admin.from('cari_kisiler').update(payload).eq('id', body.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true, id: body.id, message: 'Güncellendi.' })
    }

    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'cariKod gerekli.' }, { status: 400 })
    }
    const { data: cari } = await admin.from('cariler').select('id').eq('cari_kod', cariKod).maybeSingle()
    if (!cari?.id) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }
    const { data: eklenen, error } = await admin
      .from('cari_kisiler')
      .insert({ ...payload, cari_id: cari.id, unvan: payload.unvan || 'elle' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, id: eklenen?.id, message: 'Eklendi.' })
  } catch (cause) {
    console.error('[cari-kisi-post]', cause)
    const message = toErrorMessage(cause, 'Kaydedilemedi.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}

/** Kişi sil (kalıcı). */
export async function DELETE(request: Request) {
  try {
    await requireAuthUser()
    const body = (await request.json()) as { id?: string }
    const id = String(body.id || '').trim()
    if (!id) return NextResponse.json({ success: false, error: 'id gerekli.' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('cari_kisiler').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, message: 'Silindi.' })
  } catch (cause) {
    console.error('[cari-kisi-delete]', cause)
    const message = toErrorMessage(cause, 'Silinemedi.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}
