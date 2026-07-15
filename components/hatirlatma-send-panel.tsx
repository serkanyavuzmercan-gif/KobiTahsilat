'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, LoaderCircle, Send, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHatirlatmaMessage } from '@/components/hatirlatma-message-context'
import { WHATSAPP_SENDER_LABEL } from '@/lib/whatsapp-constants'
import { formatPhoneDisplay } from '@/lib/phone'

type HatirlatmaWhatsAppContext = {
  botEnabled: boolean
  botCevrimici: boolean
  sonPoll: string | null
  sonGonderim: string | null
}

type KuyrukDurum = 'bekliyor' | 'gonderiliyor' | 'gonderildi' | 'hata' | 'bilinmiyor'

const uyku = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function HatirlatmaSendPanel({
  cariKod,
  hasPhone,
  isMobile,
  sendEnabled,
  gonderimSayisi,
  whatsappContext,
}: {
  cariKod: string
  hasPhone: boolean
  isMobile: boolean
  sendEnabled: boolean
  gonderimSayisi: number
  whatsappContext?: HatirlatmaWhatsAppContext
}) {
  const router = useRouter()
  const { body: messageBody } = useHatirlatmaMessage()
  const [loading, setLoading] = useState(false)
  const [sentCount, setSentCount] = useState(gonderimSayisi)
  const [queue, setQueue] = useState<{ durum: KuyrukDurum; hata: string | null } | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canSend = sendEnabled && hasPhone && isMobile && messageBody.trim().length > 0

  /** Enqueue sonrası kuyruk durumunu yoklar (bekliyor → gonderildi/hata). */
  async function pollDurum(kuyrukId: string) {
    for (let deneme = 0; deneme < 20; deneme++) {
      await uyku(3000)
      try {
        const response = await fetch(
          `/api/hatirlatma/whatsapp-durum?ids=${encodeURIComponent(kuyrukId)}`
        )
        const result = (await response.json()) as {
          durumlar?: Array<{ durum: KuyrukDurum; hata: string | null }>
        }
        const kayit = result.durumlar?.[0]
        if (kayit) {
          setQueue({ durum: kayit.durum, hata: kayit.hata })
          if (kayit.durum === 'gonderildi' || kayit.durum === 'hata') return
        }
      } catch {
        // geçici okuma hatası → sonraki turda yeniden dene
      }
    }
  }

  async function sendMessage() {
    setLoading(true)
    setFeedback(null)
    setQueue(null)
    try {
      const response = await fetch('/api/hatirlatma/whatsapp-gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, messageBody: messageBody.trim() }),
      })
      const raw = await response.text()
      let result: { success?: boolean; error?: string; message?: string; kuyrukId?: string } = {}
      try {
        result = JSON.parse(raw) as typeof result
      } catch {
        throw new Error(`Sunucu yanıtı okunamadı (${response.status}). Oturum süreniz dolmuş olabilir.`)
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
      setSentCount((count) => count + 1)
      setFeedback({ type: 'success', text: result.message || 'WhatsApp mesajı kuyruğa alındı.' })
      setQueue({ durum: 'bekliyor', hata: null })
      router.refresh()
      if (result.kuyrukId) void pollDurum(result.kuyrukId)
    } catch (cause) {
      setFeedback({
        type: 'error',
        text: cause instanceof Error ? cause.message : 'Gönderilemedi.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!sendEnabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        WhatsApp gönderimi kapalı. Yönetici `WHATSAPP_SEND_ENABLED=true` ile etkinleştirebilir.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Gönderen: <strong>{WHATSAPP_SENDER_LABEL}</strong>
      </p>
      <p className="text-xs text-slate-500">
        Daha önce gönderilen: <strong>{sentCount}</strong> mesaj
      </p>

      {whatsappContext ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            {whatsappContext.botCevrimici ? (
              <>
                <Wifi size={14} className="text-emerald-600" />
                <span className="font-medium text-emerald-700">Ofis WhatsApp botu çevrimiçi</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-amber-600" />
                <span className="font-medium text-amber-700">Bot çevrimdışı</span>
              </>
            )}
          </div>
          <p className="mt-1.5 text-slate-500">
            {whatsappContext.botCevrimici
              ? 'Mesaj kuyruğa alınır alınmaz bot sırayla gönderir.'
              : 'Mesaj kuyrukta bekler; bot PC\'si açılınca otomatik gönderilir.'}
          </p>
          {whatsappContext.sonGonderim ? (
            <p className="mt-1 text-slate-400">
              Botun son gönderimi: {new Date(whatsappContext.sonGonderim).toLocaleString('tr-TR')}
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        variant="success"
        onClick={sendMessage}
        disabled={!canSend || loading}
        className="w-full"
      >
        {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
        WhatsApp kuyruğuna gönder
      </Button>

      {!hasPhone && <p className="text-xs text-red-600">Gönderim için cep telefonu gerekli.</p>}
      {hasPhone && messageBody.trim().length === 0 && (
        <p className="text-xs text-red-600">Mesaj metni boş olamaz.</p>
      )}
      {hasPhone && !isMobile && (
        <p className="text-xs text-amber-700">
          WhatsApp için cep telefonu girin (05… ile başlamalı).
        </p>
      )}

      {/* Kuyruk durum takibi */}
      {queue?.durum === 'bekliyor' || queue?.durum === 'gonderiliyor' ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <div className="flex items-center gap-2">
            <Clock className="shrink-0 animate-pulse" size={18} />
            <p>
              {queue.durum === 'gonderiliyor'
                ? 'Bot gönderiyor…'
                : 'Kuyrukta bekliyor — bot birazdan gönderecek…'}
            </p>
          </div>
        </div>
      ) : null}
      {queue?.durum === 'gonderildi' ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="shrink-0" size={18} />
            <p className="font-medium">WhatsApp mesajı gönderildi ✓</p>
          </div>
        </div>
      ) : null}
      {queue?.durum === 'hata' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-medium">Bot gönderemedi.</p>
              {queue.hata ? <p className="mt-0.5 text-xs">{queue.hata}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {feedback?.type === 'success' && !queue ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p className="font-medium">{feedback.text}</p>
          </div>
        </div>
      ) : null}
      {feedback?.type === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 shrink-0" size={18} />
            <p>{feedback.text}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function HatirlatmaPhoneStatus({
  telefon,
  telefonKaynagi,
  hasCandidate,
}: {
  telefon: string | null
  telefonKaynagi?: string | null
  hasCandidate: boolean
}) {
  if (telefon) {
    return (
      <div>
        <p className="font-medium text-slate-800">{formatPhoneDisplay(telefon)}</p>
        <p className="mt-1 text-xs text-emerald-700">
          {telefonKaynagi || 'Kayıtlı'} · gönderime hazır
        </p>
      </div>
    )
  }
  if (hasCandidate) {
    return (
      <div>
        <p className="text-slate-500">—</p>
        <p className="mt-1 text-xs text-amber-700">Telefon adayı var · önizlemede düzenleyin</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-slate-500">—</p>
      <p className="mt-1 text-xs text-red-600">Telefon bulunamadı</p>
    </div>
  )
}
