'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Mail, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MailSenderAccount } from '@/lib/types'

export function MailSenderSettings() {
  const [senders, setSenders] = useState<MailSenderAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [adSoyad, setAdSoyad] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadSenders() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici')
      const result = (await response.json()) as {
        success?: boolean
        senders?: MailSenderAccount[]
        error?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Göndericiler yüklenemedi.')
      setSenders(result.senders || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Göndericiler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSenders()
  }, [])

  async function connectSender() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adSoyad }),
      })
      const result = (await response.json()) as {
        success?: boolean
        sender?: MailSenderAccount
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Bağlantı kurulamadı.')
      setEmail('')
      setAdSoyad('')
      setMessage(result.message || 'Gönderici bağlandı.')
      await loadSenders()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bağlantı kurulamadı.')
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(id: string) {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, varsayilan: true }),
      })
      const result = (await response.json()) as {
        success?: boolean
        senders?: MailSenderAccount[]
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Varsayılan güncellenemedi.')
      setSenders(result.senders || [])
      setMessage(result.message || 'Varsayılan gönderici güncellendi.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Varsayılan güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  async function removeSender(id: string) {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = (await response.json()) as {
        success?: boolean
        senders?: MailSenderAccount[]
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderici kaldırılamadı.')
      setSenders(result.senders || [])
      setMessage(result.message || 'Gönderici kaldırıldı.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gönderici kaldırılamadı.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Mail size={16} className="text-brand-600" />
        Gönderici e-posta adresleri
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Mutabakat e-postaları hangi adresten gitsin? Bağladığınız{' '}
        <strong>@hidroteknik.com.tr</strong> adresi gönderici (From) olarak kullanılır.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ornek@hidroteknik.com.tr"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30"
        />
        <input
          value={adSoyad}
          onChange={(event) => setAdSoyad(event.target.value)}
          placeholder="Görünen ad (opsiyonel)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30"
        />
        <Button onClick={connectSender} disabled={saving || !email.trim()}>
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
          Bağla
        </Button>
      </div>

      <details className="group mt-2 text-xs">
        <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-brand-600 hover:underline">
          Nasıl çalışır? (Resend · SPF/DKIM)
        </summary>
        <p className="mt-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2.5 leading-relaxed text-sky-900">
          Gmail hesabınıza giriş yapılmaz. Gönderim <strong>Resend</strong> servisi üzerinden yapılır;
          alan adının Resend panelinde DNS ile doğrulanmış olması gerekir. Yanıtlar oturum açtığınız
          e-posta adresine yönlendirilir.
        </p>
      </details>

      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Bağlı göndericiler
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <LoaderCircle className="animate-spin" size={16} />
            Yükleniyor…
          </div>
        ) : senders.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">Henüz bağlı gönderici yok.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {senders.map((sender) => (
              <div
                key={sender.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                    <span className="truncate">
                      {sender.ad_soyad ? `${sender.ad_soyad} <${sender.email}>` : sender.email}
                    </span>
                    {sender.varsayilan && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        <Star size={10} /> Varsayılan
                      </span>
                    )}
                    {sender.sistem && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Sistem
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!sender.varsayilan && (
                    <Button
                      variant="secondary"
                      onClick={() => makeDefault(sender.id)}
                      disabled={saving}
                      className="px-2 py-1 text-xs"
                    >
                      <Star size={13} />
                      Varsayılan yap
                    </Button>
                  )}
                  {!sender.sistem && (
                    <Button
                      variant="danger"
                      onClick={() => removeSender(sender.id)}
                      disabled={saving}
                      className="px-2 py-1 text-xs"
                    >
                      <Trash2 size={13} />
                      Kaldır
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
