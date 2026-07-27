'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, LoaderCircle, Send, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHatirlatmaMessage } from '@/components/hatirlatma-message-context'
import { WHATSAPP_SENDER_LABEL } from '@/lib/whatsapp-constants'
import { formatPhoneDisplay, isMobileTurkey } from '@/lib/phone'

type HatirlatmaWhatsAppContext = {
  botEnabled: boolean
  botCevrimici: boolean
  sonPoll: string | null
  sonGonderim: string | null
}

type KuyrukDurum = 'bekliyor' | 'gonderiliyor' | 'gonderildi' | 'hata' | 'bilinmiyor'

type AliciDurum = {
  telefon: string
  kuyrukId: string | null
  durum: KuyrukDurum
  hata: string | null
}

const uyku = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const ISTEK_ZAMAN_ASIMI_MS = 30_000

export function HatirlatmaSendPanel({
  cariKod,
  telefonlar,
  sendEnabled,
  gonderimSayisi,
  whatsappContext,
}: {
  cariKod: string
  telefonlar: string[]
  sendEnabled: boolean
  gonderimSayisi: number
  whatsappContext?: HatirlatmaWhatsAppContext
}) {
  const router = useRouter()
  const { body: messageBody } = useHatirlatmaMessage()
  const [loading, setLoading] = useState(false)
  const [sentCount, setSentCount] = useState(gonderimSayisi)
  const [alicilar, setAlicilar] = useState<AliciDurum[] | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const telefonAnahtari = telefonlar.join('|')
  const cepNumaralari = useMemo(
    () => telefonlar.filter((tel) => isMobileTurkey(tel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [telefonAnahtari]
  )
  const [secili, setSecili] = useState<Set<string>>(() => new Set(cepNumaralari))

  // Telefon listesi değişirse (numara eklendi/silindi) seçimi tazele.
  useEffect(() => {
    setSecili(new Set(cepNumaralari))
    setAlicilar(null)
    setFeedback(null)
  }, [telefonAnahtari, cepNumaralari])

  const seciliSayi = [...secili].filter((tel) => cepNumaralari.includes(tel)).length
  const canSend = sendEnabled && seciliSayi > 0 && messageBody.trim().length > 0

  function toggleSecim(telefon: string) {
    setSecili((onceki) => {
      const yeni = new Set(onceki)
      if (yeni.has(telefon)) yeni.delete(telefon)
      else yeni.add(telefon)
      return yeni
    })
  }

  function aliciGuncelle(kuyrukId: string, durum: KuyrukDurum, hata: string | null) {
    setAlicilar((onceki) =>
      (onceki || []).map((item) =>
        item.kuyrukId === kuyrukId ? { ...item, durum, hata: hata ?? item.hata } : item
      )
    )
  }

  /** Enqueue sonrası tüm kuyruk satırlarının durumunu yoklar (bekliyor → gonderildi/hata). */
  async function pollDurum(ids: string[]) {
    for (let deneme = 0; deneme < 20; deneme++) {
      await uyku(3000)
      try {
        const response = await fetch(
          `/api/hatirlatma/whatsapp-durum?ids=${encodeURIComponent(ids.join(','))}`
        )
        const result = (await response.json()) as {
          durumlar?: Array<{ id: string; durum: KuyrukDurum; hata: string | null }>
        }
        let acikKaldi = false
        for (const kayit of result.durumlar || []) {
          aliciGuncelle(kayit.id, kayit.durum, kayit.hata)
          if (kayit.durum !== 'gonderildi' && kayit.durum !== 'hata') acikKaldi = true
        }
        if (!acikKaldi) return
      } catch {
        // geçici okuma hatası → sonraki turda yeniden dene
      }
    }
  }

  async function sendMessage() {
    const hedefler = [...secili].filter((tel) => cepNumaralari.includes(tel))
    if (!hedefler.length) return
    setLoading(true)
    setFeedback(null)
    setAlicilar(null)
    try {
      const controller = new AbortController()
      const zamanAsimi = setTimeout(() => controller.abort(), ISTEK_ZAMAN_ASIMI_MS)
      let raw: string
      let response: Response
      try {
        response = await fetch('/api/hatirlatma/whatsapp-gonder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cariKod, messageBody: messageBody.trim(), phones: hedefler }),
          signal: controller.signal,
        })
        raw = await response.text()
      } finally {
        clearTimeout(zamanAsimi)
      }
      let result: {
        success?: boolean
        error?: string
        message?: string
        kuyrukId?: string
        gonderimSayisi?: number
        gonderimler?: Array<{ telefon: string; kuyrukId?: string; hata?: string }>
      } = {}
      try {
        result = JSON.parse(raw) as typeof result
      } catch {
        throw new Error(`Sunucu yanıtı okunamadı (${response.status}). Oturum süreniz dolmuş olabilir.`)
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')

      const durumlar: AliciDurum[] = (result.gonderimler || []).map((item) => ({
        telefon: item.telefon,
        kuyrukId: item.kuyrukId || null,
        durum: item.kuyrukId ? 'bekliyor' : 'hata',
        hata: item.hata || null,
      }))
      setAlicilar(durumlar)
      if (typeof result.gonderimSayisi === 'number') setSentCount(result.gonderimSayisi)
      else setSentCount((count) => count + durumlar.filter((item) => item.kuyrukId).length)
      setFeedback({ type: 'success', text: result.message || 'WhatsApp ödeme talebi gönderildi.' })
      router.refresh()
      const ids = durumlar.map((item) => item.kuyrukId).filter((id): id is string => Boolean(id))
      if (ids.length) void pollDurum(ids)
    } catch (cause) {
      const mesaj =
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'Sunucu 30 saniyede yanıt vermedi. Bağlantınızı kontrol edip tekrar deneyin.'
          : cause instanceof Error
            ? cause.message
            : 'Gönderilemedi.'
      setFeedback({ type: 'error', text: mesaj })
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

  const durumEtiketi: Record<KuyrukDurum, string> = {
    bekliyor: 'Kuyrukta bekliyor',
    gonderiliyor: 'Bot gönderiyor…',
    gonderildi: 'Gönderildi ✓',
    hata: 'Gönderilemedi',
    bilinmiyor: 'Durum okunamadı',
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Gönderen: <strong>{WHATSAPP_SENDER_LABEL}</strong>
      </p>
      <p className="text-xs text-slate-500">
        Daha önce gönderilen: <strong>{sentCount}</strong> mesaj
      </p>

      {telefonlar.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-600">Alıcılar ({seciliSayi} seçili)</p>
          <ul className="mt-2 space-y-1.5">
            {telefonlar.map((telefon) => {
              const mobil = isMobileTurkey(telefon)
              return (
                <li key={telefon}>
                  <label
                    className={`flex items-center gap-2 text-sm ${
                      mobil ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={mobil && secili.has(telefon)}
                      disabled={!mobil || loading}
                      onChange={() => toggleSecim(telefon)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="font-medium text-slate-800">{formatPhoneDisplay(telefon)}</span>
                    {mobil ? (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        cep
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        sabit hat — WhatsApp alamaz
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {whatsappContext ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            {whatsappContext.botCevrimici ? (
              <>
                <Wifi size={14} className="text-emerald-600" />
                <span className="font-medium text-emerald-700">WhatsApp Cloud API hazır</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-amber-600" />
                <span className="font-medium text-amber-700">WhatsApp Cloud API yapılandırması eksik</span>
              </>
            )}
          </div>
          <p className="mt-1.5 text-slate-500">
            {whatsappContext.botCevrimici
              ? "Onaylı ödeme talebi şablonu Meta'nın resmi API'si üzerinden doğrudan gönderilir."
              : 'Gönderim için WhatsApp Cloud API erişim bilgileri kontrol edilmelidir.'}
          </p>
          {whatsappContext.sonGonderim ? (
            <p className="mt-1 text-slate-400">
              Son gönderim: {new Date(whatsappContext.sonGonderim).toLocaleString('tr-TR')}
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
        {seciliSayi > 1 ? `${seciliSayi} kişiye gönder` : 'WhatsApp ile gönder'}
      </Button>

      {telefonlar.length === 0 && (
        <p className="text-xs text-red-600">Gönderim için cep telefonu gerekli.</p>
      )}
      {telefonlar.length > 0 && cepNumaralari.length === 0 && (
        <p className="text-xs text-amber-700">
          Kayıtlı numaralar sabit hat. WhatsApp için cep telefonu girin (05… ile başlamalı).
        </p>
      )}
      {cepNumaralari.length > 0 && seciliSayi === 0 && (
        <p className="text-xs text-amber-700">Gönderim için en az bir alıcı seçin.</p>
      )}
      {telefonlar.length > 0 && messageBody.trim().length === 0 && (
        <p className="text-xs text-red-600">Mesaj metni boş olamaz.</p>
      )}

      {/* Alıcı başına kuyruk durum takibi */}
      {alicilar?.length ? (
        <ul className="space-y-1.5">
          {alicilar.map((alici) => (
            <li
              key={alici.kuyrukId || alici.telefon}
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${
                alici.durum === 'gonderildi'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : alici.durum === 'hata'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-sky-200 bg-sky-50 text-sky-900'
              }`}
            >
              {alici.durum === 'gonderildi' ? (
                <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
              ) : alici.durum === 'hata' ? (
                <TriangleAlert className="mt-0.5 shrink-0" size={16} />
              ) : (
                <Clock className="mt-0.5 shrink-0 animate-pulse" size={16} />
              )}
              <div className="min-w-0">
                <span className="font-medium">{formatPhoneDisplay(alici.telefon)}</span>
                <span className="ml-1.5">{durumEtiketi[alici.durum]}</span>
                {alici.hata ? <p className="mt-0.5 text-xs">{alici.hata}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {feedback?.type === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p className="font-medium">{feedback.text}</p>
          </div>
        </div>
      )}
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
