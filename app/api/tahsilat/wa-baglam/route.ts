import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * SUNUCU-SUNUCU (secret korumalı): WhatsApp botunun (tawkto) çağırdığı uç. Bir telefona son 60 günde
 * gönderilmiş tahsilat mesajlarını (ödeme talebi / mutabakat) özetleyip AI'ya bağlam metni döner.
 * Public anon key'e finansal veri sızmaması için service_role burada (KobiTahsilat) tutulur; tawkto
 * yalnız secret ile bu ucu çağırır. Yetkisiz istek boş bağlam alır.
 */
function son10(tel: string): string {
  return String(tel || '').replace(/\D/g, '').slice(-10)
}

function tipMetni(tip: string): string {
  if (tip === 'mutabakat') return 'cari hesap mutabakatı'
  return 'ödeme (tahsilat) hatırlatması'
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret') || request.headers.get('x-wa-baglam-secret') || ''
    const beklenen = process.env.WA_BAGLAM_SECRET || ''
    if (!beklenen || secret !== beklenen) {
      return NextResponse.json({ baglam: '' }, { status: 200 })
    }

    const s10 = son10(url.searchParams.get('tel') || '')
    if (s10.length < 10) return NextResponse.json({ baglam: '' })

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('tahsilat_wa_baglam', { p_son10: s10 })
    if (error) throw new Error(error.message)

    const rows = (data || []) as Array<{ ilgili_tip: string; sent_at: string; subject: string | null }>
    if (!rows.length) return NextResponse.json({ baglam: '' })

    const enSon = rows[0]
    const tarih = new Date(enSon.sent_at).toLocaleDateString('tr-TR')
    const ozet = rows
      .slice(0, 3)
      .map((r) => `${new Date(r.sent_at).toLocaleDateString('tr-TR')} — ${tipMetni(r.ilgili_tip)}`)
      .join('; ')

    const baglam = [
      `MÜŞTERİ BAĞLAMI (dahili — müşteriye ham gösterme): Bu WhatsApp numarasına firmamızın TAHSİLAT sistemi tarafından son dönemde ${tipMetni(enSon.ilgili_tip)} gönderildi (en son ${tarih}). Geçmiş: ${ozet}.`,
      `Bu yüzden müşteri "ödedim / bu ne / siz kimsiniz / itirazım var / ne kadar borcum var" gibi bir şey yazarsa: bunun firmamızın gönderdiği bir ödeme hatırlatması olduğunu bil, bağlamı KORU.`,
      `Ödeme/bakiye/tahsilat konusunda KESİN tutar veya "ödemeniz ulaştı/ulaşmadı" gibi bir teyit UYDURMA. "Ödediyseniz teşekkür ederiz, kaydınızı muhasebemiz kontrol edip size dönecektir; sorunuz için muhasebe ekibimize aktarıyorum" gibi güvenli, nazik yönlendir. Fiyat/ürün kurallarını yine koru.`,
    ].join(' ')

    return NextResponse.json({ baglam })
  } catch (cause) {
    console.error('[wa-baglam]', cause)
    return NextResponse.json({ baglam: '' }, { status: 200 })
  }
}
