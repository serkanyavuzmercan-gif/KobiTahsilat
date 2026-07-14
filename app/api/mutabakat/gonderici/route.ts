import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import {
  addMailSender,
  listMailSenders,
  removeMailSender,
  setDefaultMailSender,
} from '@/lib/mail-senders'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuthUser()
    const senders = await listMailSenders(user.id)
    return NextResponse.json({ success: true, senders })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Göndericiler yüklenemedi.'
    const status = message.includes('Oturum') ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { email?: string; adSoyad?: string }
    const email = String(body.email || '').trim()
    if (!email) {
      return NextResponse.json({ success: false, error: 'E-posta adresi gerekli.' }, { status: 400 })
    }

    const sender = await addMailSender(user.id, email, body.adSoyad)
    return NextResponse.json({
      success: true,
      sender,
      message: 'Gönderici e-posta adresi bağlandı.',
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gönderici eklenemedi.'
    const status = message.includes('Oturum') ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { id?: string; varsayilan?: boolean }
    const id = String(body.id || '').trim()
    if (!id) {
      return NextResponse.json({ success: false, error: 'Gönderici seçilmedi.' }, { status: 400 })
    }
    if (!body.varsayilan) {
      return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 })
    }

    await setDefaultMailSender(user.id, id)
    const senders = await listMailSenders(user.id)
    return NextResponse.json({
      success: true,
      senders,
      message: 'Varsayılan gönderici güncellendi.',
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gönderici güncellenemedi.'
    const status = message.includes('Oturum') ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUser()
    const body = (await request.json()) as { id?: string }
    const id = String(body.id || '').trim()
    if (!id) {
      return NextResponse.json({ success: false, error: 'Gönderici seçilmedi.' }, { status: 400 })
    }

    await removeMailSender(user.id, id)
    const senders = await listMailSenders(user.id)
    return NextResponse.json({
      success: true,
      senders,
      message: 'Gönderici bağlantısı kaldırıldı.',
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gönderici kaldırılamadı.'
    const status = message.includes('Oturum') ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
