'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Clock3,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  Play,
  Plus,
  Save,
  Settings2,
  Trash2,
  Volume2,
} from 'lucide-react'
import { MailSenderSettings } from '@/components/mail-sender-settings'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/summary-stat'
import type {
  AutomationConnectionsStatus,
  AutomationRule,
  AutomationRunResult,
  AutomationSettings,
  WhatsAppUserConnection,
} from '@/lib/automation/types'
import { PHONE_INPUT_HINT, PHONE_INPUT_PLACEHOLDER } from '@/lib/phone'

function newRuleId() {
  return `kural-${Date.now().toString(36)}`
}

export function AutomationSettingsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [settings, setSettings] = useState<AutomationSettings | null>(null)
  const [connections, setConnections] = useState<AutomationConnectionsStatus | null>(null)
  const [whatsapp, setWhatsapp] = useState<WhatsAppUserConnection | null>(null)
  const [whatsappInput, setWhatsappInput] = useState('')
  const [whatsappSaving, setWhatsappSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastRun, setLastRun] = useState<AutomationRunResult | null>(null)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [settingsRes, whatsappRes] = await Promise.all([
        fetch('/api/otomasyon/ayarlar'),
        fetch('/api/otomasyon/whatsapp'),
      ])
      const settingsJson = (await settingsRes.json()) as {
        success?: boolean
        settings?: AutomationSettings
        connections?: AutomationConnectionsStatus
        error?: string
      }
      const whatsappJson = (await whatsappRes.json()) as {
        success?: boolean
        connection?: WhatsAppUserConnection
        error?: string
      }

      if (!settingsRes.ok || !settingsJson.success || !settingsJson.settings) {
        throw new Error(settingsJson.error || 'Ayarlar yüklenemedi.')
      }
      if (!whatsappRes.ok || !whatsappJson.success) {
        throw new Error(whatsappJson.error || 'WhatsApp bağlantısı yüklenemedi.')
      }

      setSettings(settingsJson.settings)
      setConnections(settingsJson.connections || null)
      setWhatsapp(whatsappJson.connection || null)
      setWhatsappInput(whatsappJson.connection?.display || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ayarlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/otomasyon/ayarlar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const result = (await response.json()) as {
        success?: boolean
        settings?: AutomationSettings
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Kaydedilemedi.')
      setSettings(result.settings || settings)
      setMessage(result.message || 'Ayarlar kaydedildi.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  async function saveWhatsapp() {
    setWhatsappSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/otomasyon/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon: whatsappInput }),
      })
      const result = (await response.json()) as {
        success?: boolean
        connection?: WhatsAppUserConnection
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Kaydedilemedi.')
      setWhatsapp(result.connection || null)
      setWhatsappInput(result.connection?.display || whatsappInput)
      setMessage(result.message || 'WhatsApp numarası kaydedildi.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.')
    } finally {
      setWhatsappSaving(false)
    }
  }

  async function runAutomation(dryRun: boolean) {
    setRunning(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/otomasyon/calistir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const result = (await response.json()) as {
        success?: boolean
        result?: AutomationRunResult
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Çalıştırılamadı.')
      setLastRun(result.result || null)
      setMessage(result.message || 'Otomasyon çalıştırıldı.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Çalıştırılamadı.')
    } finally {
      setRunning(false)
    }
  }

  function updateRule(index: number, patch: Partial<AutomationRule>) {
    if (!settings) return
    const kurallar = settings.kurallar.map((rule, i) =>
      i === index ? { ...rule, ...patch } : rule
    )
    setSettings({ ...settings, kurallar })
  }

  function addRule() {
    if (!settings) return
    const kurallar = [
      ...settings.kurallar,
      {
        id: newRuleId(),
        kanal: 'email' as const,
        min_ortalama_gecikme_gun: 30,
        aktif: false,
        etiket: 'Yeni kural',
      },
    ]
    setSettings({ ...settings, kurallar })
  }

  function removeRule(index: number) {
    if (!settings) return
    setSettings({
      ...settings,
      kurallar: settings.kurallar.filter((_, i) => i !== index),
    })
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
        <LoaderCircle className="animate-spin" size={18} />
        Ayarlar yükleniyor…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-50 p-3 text-brand-700">
              <Bot size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Tahsilat otomasyonu</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Ortalama gecikme süresine göre e-posta ve WhatsApp hatırlatmalarını planlayın.
                Bu sürüm ön hazırlıktır; varsayılan olarak <strong>taslak mod</strong> açıktır.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={settings.otomasyon_aktif ? 'ok' : 'neutral'}>
              {settings.otomasyon_aktif ? 'Otomasyon açık' : 'Otomasyon kapalı'}
            </StatusBadge>
            <StatusBadge tone={settings.taslak_mod ? 'warn' : 'ok'}>
              {settings.taslak_mod ? 'Taslak mod' : 'Canlı gönderim'}
            </StatusBadge>
            {connections && (
              <StatusBadge tone={connections.otomasyon_global_acik ? 'ok' : 'warn'}>
                {connections.otomasyon_global_acik ? 'Sistem aktif' : 'Sistem beklemede'}
              </StatusBadge>
            )}
          </div>
        </div>

        {connections && !connections.otomasyon_global_acik && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              Canlı otomatik gönderim için yönetici{' '}
              <code className="rounded bg-white px-1">OTOMATIK_TAHSILAT_ENABLED=true</code> ve{' '}
              <code className="rounded bg-white px-1">CRON_SECRET</code> tanımlamalıdır. Şimdilik
              taslak mod ile adayları test edebilirsiniz.
            </p>
          </div>
        )}
      </section>

      <section className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <Settings2 size={18} className="text-brand-600" />
          Bağlantı durumu
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ConnectionCard
            icon={<Mail size={18} />}
            title="E-posta"
            ok={connections?.email_bagli}
            detail={connections?.email_varsayilan || 'Gönderici bağlı değil'}
          />
          <ConnectionCard
            icon={<Phone size={18} />}
            title="WhatsApp numaranız"
            ok={Boolean(whatsapp?.telefon)}
            detail={whatsapp?.display || 'Numara bağlı değil'}
          />
          <ConnectionCard
            icon={<MessageCircle size={18} />}
            title="WhatsApp API"
            ok={connections?.whatsapp_api_yapilandirildi}
            detail={
              connections?.whatsapp_gonderim_acik ? 'Gönderim açık' : 'Gönderim kapalı (env)'
            }
          />
          <ConnectionCard
            icon={<Clock3 size={18} />}
            title="Çalışma zamanı"
            ok
            detail={`${settings.calisma_saati} · ${settings.sadece_is_gunu ? 'iş günleri' : 'her gün'}`}
          />
        </div>
      </section>

      <section id="whatsapp" className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <MessageCircle size={18} className="text-emerald-600" />
          WhatsApp bağlantısı
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Otomasyon sorumlusu olarak iletişim numaranızı kaydedin. Mesajlar Meta işletme hattından
          gider; API anahtarları sunucu ortamında tanımlıdır.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={whatsappInput}
            onChange={(event) => setWhatsappInput(event.target.value)}
            placeholder={PHONE_INPUT_PLACEHOLDER}
            className="input-field flex-1"
          />
          <Button onClick={saveWhatsapp} disabled={whatsappSaving || !whatsappInput.trim()}>
            {whatsappSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
            Numarayı bağla
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{PHONE_INPUT_HINT}</p>
      </section>

      <section id="eposta">
        <MailSenderSettings />
      </section>

      <section className="card p-6">
        <h3 className="font-semibold">Otomasyon kuralları</h3>
        <p className="mt-1 text-sm text-slate-500">
          Her kural, carinin <strong>ortalama gecikme süresi</strong> belirtilen gün ve üzerindeyse
          ve vadesi geçmiş bakiyesi varsa tetiklenir.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={settings.otomasyon_aktif}
              onChange={(event) =>
                setSettings({ ...settings, otomasyon_aktif: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-sm font-medium">Otomasyonu etkinleştir</span>
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={settings.taslak_mod}
              onChange={(event) => setSettings({ ...settings, taslak_mod: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-sm">
              <span className="font-medium">Taslak mod</span>
              <span className="block text-xs text-slate-500">
                Açıkken gönderim yapılmaz; yalnızca uygun cariler listelenir.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Çalışma saati (TR)</span>
              <input
                type="time"
                value={settings.calisma_saati}
                onChange={(event) =>
                  setSettings({ ...settings, calisma_saati: event.target.value })
                }
                className="input-field mt-1 w-full"
              />
            </label>
            <label className="flex items-end gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={settings.sadece_is_gunu}
                onChange={(event) =>
                  setSettings({ ...settings, sadece_is_gunu: event.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm">Yalnızca iş günlerinde çalış</span>
            </label>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Aktif</th>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Min. ort. gecikme (gün)</th>
                <th className="px-4 py-3">Etiket</th>
                <th className="px-4 py-3 text-right">Sil</th>
              </tr>
            </thead>
            <tbody>
              {settings.kurallar.map((rule, index) => (
                <tr key={rule.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={rule.aktif}
                      onChange={(event) => updateRule(index, { aktif: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={rule.kanal}
                      onChange={(event) =>
                        updateRule(index, {
                          kanal: event.target.value as AutomationRule['kanal'],
                        })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="email">E-posta</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={rule.min_ortalama_gecikme_gun}
                      onChange={(event) =>
                        updateRule(index, {
                          min_ortalama_gecikme_gun: Number(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={rule.etiket}
                      onChange={(event) => updateRule(index, { etiket: event.target.value })}
                      className="w-full min-w-48 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Kuralı sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={addRule}>
            <Plus size={16} />
            Kural ekle
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
            Ayarları kaydet
          </Button>
          <Button variant="secondary" onClick={() => runAutomation(true)} disabled={running}>
            {running ? <LoaderCircle className="animate-spin" size={16} /> : <Play size={16} />}
            Taslak çalıştır
          </Button>
          <Button
            variant="success"
            onClick={() => runAutomation(false)}
            disabled={running || settings.taslak_mod}
            title={settings.taslak_mod ? 'Canlı gönderim için taslak modu kapatın' : undefined}
          >
            Canlı çalıştır
          </Button>
        </div>
      </section>

      <section className="card border-dashed p-6 opacity-90">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
            <Volume2 size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-700">Sesli arama</h3>
              <StatusBadge tone="neutral">Geliştirme aşamasında</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              İleride ortalama gecikme eşiğine ulaşan carilere otomatik sesli hatırlatma eklenecek.
              Altyapı bu ayarlar ekranından yönetilecek şekilde planlandı.
            </p>
          </div>
        </div>
      </section>

      {lastRun && (
        <section className="card p-6">
          <h3 className="font-semibold">Son çalıştırma özeti</h3>
          <p className="mt-1 text-sm text-slate-500">
            {lastRun.aday_sayisi} aday · {lastRun.gonderilen} gönderim · {lastRun.atlanan} atlandı
            {lastRun.taslak_mod ? ' · taslak mod' : ''}
          </p>
          {lastRun.hatalar.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {lastRun.hatalar.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {lastRun.adaylar.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Firma</th>
                    <th className="px-3 py-2">Kanal</th>
                    <th className="px-3 py-2">Ort. gecikme</th>
                    <th className="px-3 py-2">Alıcı</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {lastRun.adaylar.slice(0, 20).map((aday) => (
                    <tr key={`${aday.kanal}-${aday.cari_kod}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium">{aday.firma_adi}</p>
                        <p className="text-xs text-slate-400">{aday.cari_kod}</p>
                      </td>
                      <td className="px-3 py-2 capitalize">{aday.kanal}</td>
                      <td className="px-3 py-2">{aday.ortalama_gecikme_gun} gün</td>
                      <td className="px-3 py-2">{aday.alici || '—'}</td>
                      <td className="px-3 py-2">
                        {aday.engel ? (
                          <span className="text-amber-700">{aday.engel}</span>
                        ) : (
                          <span className="text-emerald-700">Hazır</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function ConnectionCard({
  icon,
  title,
  ok,
  detail,
}: {
  icon: React.ReactNode
  title: string
  ok?: boolean
  detail: string
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <span className={ok ? 'text-emerald-600' : 'text-amber-600'}>{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs text-slate-600">{detail}</p>
    </div>
  )
}
