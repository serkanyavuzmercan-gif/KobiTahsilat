'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Clock3,
  ListChecks,
  LoaderCircle,
  Mail,
  MessageCircle,
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
} from '@/lib/automation/types'

function newRuleId() {
  return `kural-${Date.now().toString(36)}`
}

const NAV = [
  { id: 'genel', label: 'Genel', icon: Bot },
  { id: 'baglanti', label: 'Bağlantı durumu', icon: Settings2 },
  { id: 'eposta', label: 'E-posta göndericileri', icon: Mail },
  { id: 'kurallar', label: 'Otomasyon kuralları', icon: ListChecks },
  { id: 'sesli', label: 'Sesli arama', icon: Volume2 },
]

export function AutomationSettingsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [settings, setSettings] = useState<AutomationSettings | null>(null)
  const [connections, setConnections] = useState<AutomationConnectionsStatus | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastRun, setLastRun] = useState<AutomationRunResult | null>(null)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const settingsRes = await fetch('/api/otomasyon/ayarlar')
      const settingsJson = (await settingsRes.json()) as {
        success?: boolean
        settings?: AutomationSettings
        connections?: AutomationConnectionsStatus
        error?: string
      }

      if (!settingsRes.ok || !settingsJson.success || !settingsJson.settings) {
        throw new Error(settingsJson.error || 'Ayarlar yüklenemedi.')
      }

      setSettings(settingsJson.settings)
      setConnections(settingsJson.connections || null)
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
    const kurallar = settings.kurallar.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
    setSettings({ ...settings, kurallar })
  }

  function addRule() {
    if (!settings) return
    setSettings({
      ...settings,
      kurallar: [
        ...settings.kurallar,
        {
          id: newRuleId(),
          kanal: 'email' as const,
          min_ortalama_gecikme_gun: 30,
          aktif: false,
          etiket: 'Yeni kural',
        },
      ],
    })
  }

  function removeRule(index: number) {
    if (!settings) return
    setSettings({ ...settings, kurallar: settings.kurallar.filter((_, i) => i !== index) })
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
        <LoaderCircle className="animate-spin" size={18} />
        Ayarlar yükleniyor…
      </div>
    )
  }

  const aktifKural = settings.kurallar.filter((r) => r.aktif).length

  return (
    <div className="lg:grid lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-5">
      {/* Sol: sticky navigasyon + durum + kaydet */}
      <aside className="mb-4 lg:mb-0">
        <div className="space-y-3 lg:sticky lg:top-4">
          <nav className="rounded-xl border border-slate-200 bg-white p-1.5">
            {NAV.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <Icon size={16} className="text-slate-400" />
                  {item.label}
                </a>
              )
            })}
          </nav>

          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Durum</p>
            <div className="flex flex-col gap-1.5">
              <StatusBadge
                tone={settings.otomasyon_aktif ? 'ok' : 'neutral'}
                title="Bu kullanıcı için otomasyon ana anahtarı (aşağıdaki “Otomasyonu etkinleştir”). Kapalıyken hatırlatmalar zamanlanmaz."
              >
                {settings.otomasyon_aktif ? 'Otomasyon açık' : 'Otomasyon kapalı'}
              </StatusBadge>
              <StatusBadge
                tone={settings.taslak_mod ? 'warn' : 'ok'}
                title="Taslak mod: çalıştırınca gerçek gönderim YAPILMAZ, yalnızca uygun cariler listelenir. Kapatınca gerçekten gönderilir."
              >
                {settings.taslak_mod ? 'Taslak mod' : 'Canlı gönderim'}
              </StatusBadge>
              {connections && (
                <StatusBadge
                  tone={connections.otomasyon_global_acik ? 'ok' : 'warn'}
                  title="Sunucu düzeyi emniyet: OTOMATIK_TAHSILAT_ENABLED=true (+ CRON_SECRET) yoksa zamanlanmış canlı gönderim tüm sistemde kapalıdır."
                >
                  {connections.otomasyon_global_acik ? 'Sistem aktif' : 'Sistem beklemede'}
                </StatusBadge>
              )}
            </div>
            <div className="border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              {aktifKural} aktif kural · {settings.calisma_saati}
            </div>
            <Button onClick={saveSettings} disabled={saving} className="w-full justify-center">
              {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
              Ayarları kaydet
            </Button>
          </div>
        </div>
      </aside>

      {/* Sağ: içerik */}
      <div className="space-y-4">
        {/* Genel */}
        <section id="genel" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Bot size={17} className="text-brand-600" />
              Tahsilat otomasyonu
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <StatusBadge tone={settings.otomasyon_aktif ? 'ok' : 'neutral'}>
                {settings.otomasyon_aktif ? 'Açık' : 'Kapalı'}
              </StatusBadge>
              <StatusBadge tone={settings.taslak_mod ? 'warn' : 'ok'}>
                {settings.taslak_mod ? 'Taslak' : 'Canlı'}
              </StatusBadge>
            </div>
          </div>

          {connections && !connections.otomasyon_global_acik && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p>
                Canlı otomatik gönderim için yönetici{' '}
                <code className="rounded bg-white px-1">OTOMATIK_TAHSILAT_ENABLED=true</code> ve{' '}
                <code className="rounded bg-white px-1">CRON_SECRET</code> tanımlamalıdır. Şimdilik
                taslak mod ile adayları test edebilirsiniz.
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={settings.otomasyon_aktif}
                onChange={(e) => setSettings({ ...settings, otomasyon_aktif: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm font-medium">Otomasyonu etkinleştir</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={settings.taslak_mod}
                onChange={(e) => setSettings({ ...settings, taslak_mod: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm">
                <span className="font-medium">Taslak mod</span>
                <span className="block text-[11px] text-slate-500">Gönderim yapılmaz, listeler</span>
              </span>
            </label>

            <label className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-xs font-medium text-slate-500">Çalışma saati (TR)</span>
              <input
                type="time"
                value={settings.calisma_saati}
                onChange={(e) => setSettings({ ...settings, calisma_saati: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={settings.sadece_is_gunu}
                onChange={(e) => setSettings({ ...settings, sadece_is_gunu: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm">Yalnızca iş günlerinde çalış</span>
            </label>
          </div>
        </section>

        {/* Bağlantı durumu */}
        <section
          id="baglanti"
          className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Settings2 size={16} className="text-brand-600" />
            Bağlantı durumu
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <ConnectionCard
              icon={<Mail size={16} />}
              title="E-posta"
              ok={connections?.email_bagli}
              detail={connections?.email_varsayilan || 'Gönderici bağlı değil'}
            />
            <ConnectionCard
              icon={<MessageCircle size={16} />}
              title="Ofis WhatsApp botu"
              ok={connections?.whatsapp_api_yapilandirildi}
              detail={
                connections?.whatsapp_api_yapilandirildi
                  ? connections?.whatsapp_gonderim_acik
                    ? 'Çevrimiçi · gönderim açık'
                    : 'Çevrimiçi · gönderim kapalı'
                  : 'Çevrimdışı (heartbeat yok)'
              }
            />
            <ConnectionCard
              icon={<Clock3 size={16} />}
              title="Çalışma zamanı"
              ok
              detail={`${settings.calisma_saati} · ${settings.sadece_is_gunu ? 'iş günleri' : 'her gün'}`}
            />
          </div>
        </section>

        {/* E-posta göndericileri */}
        <section id="eposta" className="scroll-mt-4">
          <MailSenderSettings />
        </section>

        {/* Otomasyon kuralları */}
        <section
          id="kurallar"
          className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ListChecks size={16} className="text-brand-600" />
            Otomasyon kuralları
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Her kural, carinin <strong>ortalama gecikme süresi</strong> belirtilen gün ve üzerindeyse
            ve vadesi geçmiş bakiyesi varsa tetiklenir.
          </p>

          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Aktif</th>
                  <th className="px-3 py-2">Kanal</th>
                  <th className="px-3 py-2">Min. ort. gecikme</th>
                  <th className="px-3 py-2">Etiket</th>
                  <th className="px-3 py-2 text-right">Sil</th>
                </tr>
              </thead>
              <tbody>
                {settings.kurallar.map((rule, index) => (
                  <tr key={rule.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={rule.aktif}
                        onChange={(e) => updateRule(index, { aktif: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.kanal}
                        onChange={(e) =>
                          updateRule(index, { kanal: e.target.value as AutomationRule['kanal'] })
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="email">E-posta</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={3650}
                          value={rule.min_ortalama_gecikme_gun}
                          onChange={(e) =>
                            updateRule(index, { min_ortalama_gecikme_gun: Number(e.target.value) })
                          }
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-slate-400">gün</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.etiket}
                        onChange={(e) => updateRule(index, { etiket: e.target.value })}
                        className="w-full min-w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Kuralı sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {settings.kurallar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">
                      Henüz kural yok. “Kural ekle” ile başlayın.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={addRule}>
              <Plus size={15} />
              Kural ekle
            </Button>
            <Button variant="secondary" onClick={() => runAutomation(true)} disabled={running}>
              {running ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={15} />}
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
            <span className="ml-auto text-xs text-slate-400">
              Değişiklikleri soldaki “Ayarları kaydet” ile kalıcı yapın
            </span>
          </div>
        </section>

        {/* Sesli arama */}
        <section
          id="sesli"
          className="scroll-mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-100 p-2.5 text-slate-500">
              <Volume2 size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Sesli arama</h3>
                <StatusBadge tone="neutral">Geliştirme aşamasında</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                İleride ortalama gecikme eşiğine ulaşan carilere otomatik sesli hatırlatma eklenecek.
                Altyapı bu ekrandan yönetilecek şekilde planlandı.
              </p>
            </div>
          </div>
        </section>

        {lastRun && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">Son çalıştırma özeti</h3>
            <p className="mt-1 text-xs text-slate-500">
              {lastRun.aday_sayisi} aday · {lastRun.gonderilen} gönderim · {lastRun.atlanan} atlandı
              {lastRun.taslak_mod ? ' · taslak mod' : ''}
            </p>
            {lastRun.hatalar.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
                {lastRun.hatalar.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {lastRun.adaylar.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-[640px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
                          <p className="text-[11px] text-slate-400">{aday.cari_kod}</p>
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
      className={`rounded-lg border p-3 ${
        ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <span className={ok ? 'text-emerald-600' : 'text-amber-600'}>{icon}</span>
        {title}
      </div>
      <p className="mt-1.5 text-xs text-slate-600">{detail}</p>
    </div>
  )
}
