import 'server-only'
import { createAdminClient } from './supabase/admin'
import { normalizePhone } from './phone'

/**
 * Tahsilat WhatsApp gönderimi — ss ile ORTAK Baileys kuyruğu (`whatsapp_kuyruk`).
 *
 * Meta resmi Cloud API DEĞİL. Mesajı `whatsapp_kuyruk`'a `durum='bekliyor'` yazarız;
 * ofis PC'sindeki Baileys botu (ss `tools/whatsapp-bot`) ss uç noktasını poll'leyip
 * `durum='bekliyor'` olan TÜM satırları çeker, `sock.sendMessage(grup_jid, {text})` ile
 * gönderir ve ack'ler. Bot `grup_jid`'i olduğu gibi Baileys'e verdiği için birey DM'i
 * (`<numara>@s.whatsapp.net`) grup JID'i (`…@g.us`) ile aynı şekilde çalışır — bot tarafında
 * değişiklik gerekmez.
 *
 * Aynı Supabase projesi ss ve KobiTahsilat arasında paylaşıldığı için ek endpoint/bot yok.
 * Tahsilat satırlarında `siparis_id/siparis_ids` boş kalır → ss ack'i satın-almaya dokunmaz.
 */

export type WhatsAppKuyrukDurum = 'bekliyor' | 'gonderiliyor' | 'gonderildi' | 'hata'

/** Ofis botu ~10 sn'de bir poll ediyor; bu süreden yeni heartbeat varsa çevrimiçi sayılır. */
const BOT_CEVRIMICI_ESIK_MS = 90_000

/** Kuyruk gönderimi açık mı? (bot çalışsa da bu bayrakla enqueue kapatılabilir) */
export function whatsAppBotEnabled(): boolean {
  return process.env.WHATSAPP_SEND_ENABLED !== 'false'
}

/** Türkiye cep/telefonunu Baileys DM JID'ine çevirir: 905XXXXXXXXX@s.whatsapp.net */
export function phoneToWhatsAppJid(phone: string): string {
  const normalized = normalizePhone(phone)
  const digits = (normalized || phone).replace(/\D/g, '')
  if (!/^90\d{10}$/.test(digits)) {
    throw new Error('Geçerli bir Türkiye telefon numarası gerekli (90XXXXXXXXXX).')
  }
  return `${digits}@s.whatsapp.net`
}

export type EnqueueResult = { kuyrukId: string; jid: string }

/** Bir tahsilat mesajını ortak WhatsApp kuyruğuna DM olarak ekler. */
export async function enqueueWhatsAppDM(options: {
  telefon: string
  mesaj: string
  firmaAdi?: string | null
  etiket?: string | null
}): Promise<EnqueueResult> {
  const jid = phoneToWhatsAppJid(options.telefon)
  const mesaj = options.mesaj.trim()
  if (!mesaj) throw new Error('Mesaj metni boş olamaz.')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('whatsapp_kuyruk')
    .insert({
      grup_jid: jid,
      grup_ad: options.etiket?.trim() || 'Tahsilat hatırlatma',
      tedarikci_ad: options.firmaAdi?.trim() || null,
      mesaj: mesaj.slice(0, 4096),
      durum: 'bekliyor',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`WhatsApp kuyruğa eklenemedi: ${error?.message || 'bilinmeyen hata'}`)
  }
  return { kuyrukId: String(data.id), jid }
}

export type KuyrukDurumKayit = {
  durum: WhatsAppKuyrukDurum
  gonderildi_at: string | null
  hata: string | null
  deneme: number
}

/** Kuyruk satırlarının güncel durumunu id'ye göre okur (UI durum takibi için). */
export async function getKuyrukDurum(
  ids: string[]
): Promise<Map<string, KuyrukDurumKayit>> {
  const map = new Map<string, KuyrukDurumKayit>()
  const temiz = [...new Set(ids.filter(Boolean))]
  if (!temiz.length) return map

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('whatsapp_kuyruk')
    .select('id, durum, gonderildi_at, hata, deneme')
    .in('id', temiz)
  if (error) throw error

  for (const row of data || []) {
    map.set(String(row.id), {
      durum: (row.durum as WhatsAppKuyrukDurum) || 'bekliyor',
      gonderildi_at: row.gonderildi_at ? String(row.gonderildi_at) : null,
      hata: row.hata ? String(row.hata) : null,
      deneme: Number(row.deneme) || 0,
    })
  }
  return map
}

export type BotDurum = {
  cevrimici: boolean
  son_poll_at: string | null
  son_gonderim_at: string | null
}

/** Ofis botunun heartbeat'ini (whatsapp_bot_state) okur → panelde "bot çevrimiçi mi". */
export async function loadBotDurum(now = new Date()): Promise<BotDurum> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('whatsapp_bot_state')
      .select('son_poll_at, son_gonderim_at')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return { cevrimici: false, son_poll_at: null, son_gonderim_at: null }

    const sonPoll = data.son_poll_at ? String(data.son_poll_at) : null
    const cevrimici = sonPoll
      ? now.getTime() - new Date(sonPoll).getTime() < BOT_CEVRIMICI_ESIK_MS
      : false
    return {
      cevrimici,
      son_poll_at: sonPoll,
      son_gonderim_at: data.son_gonderim_at ? String(data.son_gonderim_at) : null,
    }
  } catch {
    return { cevrimici: false, son_poll_at: null, son_gonderim_at: null }
  }
}
