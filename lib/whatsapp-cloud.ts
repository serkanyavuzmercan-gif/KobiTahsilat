import 'server-only'

/**
 * Resmi WhatsApp Cloud API gönderimi (Baileys'in yerini alır).
 * Yapılandırma env'den gelir (ss/tawkto ile ortak 0258 251 40 60 hattı):
 *   WHATSAPP_TOKEN            — kalıcı System User erişim token'ı
 *   WHATSAPP_PHONE_NUMBER_ID  — gönderim numarasının Phone Number ID'si
 *   WHATSAPP_GRAPH_VERSION    — (ops.) Graph API sürümü, varsayılan v21.0
 *
 * Proaktif (24 saat penceresi dışı) gönderim ancak Meta onaylı bir ŞABLON ile
 * yapılabilir; serbest metin reddedilir. Bu yüzden yalnız şablon gönderimi sunulur.
 */

const TOKEN = process.env.WHATSAPP_TOKEN || ''
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`

export type WhatsAppSendResult =
  | { ok: true; wamid: string }
  | { ok: false; error: string; code?: number }

/** WhatsApp şablon parametresi tek satır olmalı (newline / 4+ boşluk yasak). */
function tekSatir(text: string): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

/** Cloud API yapılandırılmış mı? (token + phone id var mı) */
export function whatsAppCloudYapili(): boolean {
  return Boolean(TOKEN && PHONE_ID)
}

/**
 * Onaylı bir WhatsApp şablonunu gönderir. bodyParams sırası şablondaki
 * {{1}}, {{2}}, … ile birebir eşleşmelidir.
 */
export async function sendWhatsAppTemplate(opts: {
  to: string
  template: string
  lang: string
  bodyParams: string[]
}): Promise<WhatsAppSendResult> {
  if (!TOKEN || !PHONE_ID) {
    return { ok: false, error: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID tanımlı değil.' }
  }
  const to = String(opts.to || '').replace(/\D/g, '')
  if (!to) return { ok: false, error: 'Geçersiz alıcı numarası.' }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: opts.template,
      language: { code: opts.lang },
      components: [
        {
          type: 'body',
          parameters: opts.bodyParams.map((t) => ({ type: 'text', text: tekSatir(t) })),
        },
      ],
    },
  }

  try {
    const r = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = (await r.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>
      error?: { message?: string; code?: number; error_data?: { details?: string } }
    }
    if (!r.ok || j.error) {
      const code = j.error?.code
      // Şablon henüz onaylanmadıysa / bulunamadıysa Meta 132xxx döndürür → dostça açıkla.
      if (code && code >= 132000 && code < 133000) {
        return {
          ok: false,
          error:
            'WhatsApp şablonu Meta onayında görünüyor (veya bulunamadı). Onaylanınca gönderim otomatik çalışacaktır.',
          code,
        }
      }
      const detay = j.error?.error_data?.details
      return {
        ok: false,
        error: detay || j.error?.message || `WhatsApp gönderim hatası (${r.status}).`,
        code,
      }
    }
    return { ok: true, wamid: j.messages?.[0]?.id || '' }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'WhatsApp isteği başarısız.' }
  }
}
