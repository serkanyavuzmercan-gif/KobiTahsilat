'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, LoaderCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecipientPicker } from '@/components/recipient-picker'

export function MutabakatSendPanel({
  cariKod,
  mutabakatTarihi,
  bugun,
  hasRecipient,
  emailAdresleri,
  sendBlocked,
  blockedUntil,
  sendEnabled,
  emailEtiket,
}: {
  cariKod: string
  mutabakatTarihi: string
  bugun: string
  hasRecipient: boolean
  emailAdresleri: string[]
  sendBlocked: boolean
  blockedUntil: string | null
  sendEnabled: boolean
  emailEtiket?: Record<string, string>
}) {
  const mailFormat = (e: string) => {
    const l = emailEtiket?.[e]
    return e + (l ? `  —  ${l}` : '')
  }
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [adresler, setAdresler] = useState<string[]>(emailAdresleri)
  // Varsayılan: yalnız ilk (birincil) adres seçili. Hepsine birden ASLA gitmez.
  const [alicilar, setAlicilar] = useState<string[]>(emailAdresleri.slice(0, 1))

  async function adresSil(email: string) {
    setAdresler((list) => list.filter((e) => e !== email))
    setAlicilar((list) => list.filter((e) => e !== email))
    try {
      await fetch('/api/cari-email/gizle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, email }),
      })
    } catch {
      /* optimistik; sonraki yüklemede zaten elenir */
    }
  }

  const gecmisTarih = mutabakatTarihi !== bugun
  const canSend = sendEnabled && hasRecipient && !sendBlocked && alicilar.length > 0

  /** Tarihi URL'e yazar → sayfa yeniden render olur, önizleme + token seçilen tarihi kullanır. */
  function setTarih(value: string) {
    if (!value) return
    router.replace(`/mutabakat/${encodeURIComponent(cariKod)}?d=${value}`)
  }

  async function sendMutabakat() {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, mutabakatTarihi, recipients: alicilar }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string; message?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
      setMessage(result.message || 'Mutabakat gönderildi.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  if (!sendEnabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Gönderim şu anda kapalı. Yönetici onayından sonra etkinleştirilecek.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mutabakat tarihi seçimi */}
      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <CalendarDays size={13} className="text-brand-600" />
          Mutabakat tarihi
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="date"
            value={mutabakatTarihi}
            max={bugun}
            onChange={(event) => setTarih(event.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          {gecmisTarih && (
            <button
              type="button"
              onClick={() => setTarih(bugun)}
              className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
            >
              Bugüne al
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] leading-tight text-slate-400">
          {gecmisTarih
            ? 'Geçmiş tarihli mutabakat — muhatabın işlemediği yeni faturalara takılmaz. Yanıt süresi yine bugünden 8 iş günü.'
            : 'Bugün tarihli mutabakat. Geçmiş tarih için yukarıdan seçin.'}
        </p>
      </div>

      {adresler.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <RecipientPicker
            addresses={adresler}
            selected={alicilar}
            onChange={setAlicilar}
            format={mailFormat}
            onRemove={adresSil}
          />
        </div>
      )}

      <Button
        onClick={sendMutabakat}
        disabled={!canSend || loading}
        title={
          !hasRecipient
            ? 'Alıcı e-postası gerekli'
            : sendBlocked
              ? '8 iş günü bekleme süresi aktif'
              : undefined
        }
        className="w-full"
      >
        {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
        Mutabakat gönder
      </Button>

      {!hasRecipient && (
        <p className="text-xs text-red-600">Gönderim için doğrulanmış alıcı e-postası gerekli.</p>
      )}
      {sendBlocked && blockedUntil && (
        <p className="text-xs text-amber-700">
          Tekrar gönderim: {new Date(blockedUntil).toLocaleDateString('tr-TR')}
        </p>
      )}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
