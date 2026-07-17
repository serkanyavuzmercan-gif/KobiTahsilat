'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Handshake,
  LoaderCircle,
  Mail,
  MessageCircle,
  Play,
  Save,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/summary-stat'
import type {
  AutomationConnectionsStatus,
  AutomationRunResult,
  AutomationSettings,
  Frekans,
  OdemeTalepKanal,
} from '@/lib/automation/types'

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
      const res = await fetch('/api/otomasyon/ayarlar')
      const json = (await res.json()) as {
        success?: boolean
        settings?: AutomationSettings
        connections?: AutomationConnectionsStatus
        error?: string
      }
      if (!res.ok || !json.success || !json.settings) {
        throw new Error(json.error || 'Ayarlar yüklenemedi.')
      }
      setSettings(json.settings)
      setConnections(json.connections || null)
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
      const res = await fetch('/api/otomasyon/ayarlar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const result = (await res.json()) as {
        success?: boolean
        settings?: AutomationSettings
        error?: string
        message?: string
      }
      if (!res.ok || !result.success) throw new Error(result.error || 'Kaydedilemedi.')
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
    if (!settings) return
    setRunning(true)
    setMessage('')
    setError('')
    try {
      // Çalıştırma sunucudaki KAYITLI ayarları kullanır → önce ekrandakini kaydet ki
      // az önce açtığın "Aktif"/eşik/frekans değişiklikleri bu çalıştırmaya yansısın.
      const saveRes = await fetch('/api/otomasyon/ayarlar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const saveJson = (await saveRes.json()) as { success?: boolean; settings?: AutomationSettings; error?: string }
      if (!saveRes.ok || !saveJson.success) throw new Error(saveJson.error || 'Ayarlar kaydedilemedi.')
      if (saveJson.settings) setSettings(saveJson.settings)

      const res = await fetch('/api/otomasyon/calistir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Canlı "Şimdi çalıştır" frekans/çalışma-saati kapılarını atlar (force).
        body: JSON.stringify({ dryRun, force: !dryRun }),
      })
      const result = (await res.json()) as {
        success?: boolean
        result?: AutomationRunResult
        error?: string
        message?: string
      }
      if (!res.ok || !result.success) throw new Error(result.error || 'Çalıştırılamadı.')
      setLastRun(result.result || null)
      setMessage(result.message || 'Otomasyon çalıştırıldı.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Çalıştırılamadı.')
    } finally {
      setRunning(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
        <LoaderCircle className="animate-spin" size={18} />
        Ayarlar yükleniyor…
      </div>
    )
  }

  const m = settings.mutabakat
  const o = settings.odeme_talebi
  const patchM = (patch: Partial<AutomationSettings['mutabakat']>) =>
    setSettings({ ...settings, mutabakat: { ...settings.mutabakat, ...patch } })
  const patchO = (patch: Partial<AutomationSettings['odeme_talebi']>) =>
    setSettings({ ...settings, odeme_talebi: { ...settings.odeme_talebi, ...patch } })

  const gmailOk = Boolean(connections?.email_bagli)
  const waOk = Boolean(connections?.whatsapp_api_yapilandirildi)
  const sistemOk = Boolean(connections?.otomasyon_global_acik)
  const hepsiHazir = gmailOk && sistemOk

  return (
    <div className="space-y-4">
      {/* Üst: otomatik moda hazırlık bilgilendirmesi */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CheckCircle2 size={17} className={hepsiHazir ? 'text-emerald-600' : 'text-amber-600'} />
            Otomatik moda hazırlık
          </div>
          <StatusBadge tone={hepsiHazir ? 'ok' : 'warn'}>
            {hepsiHazir ? 'Hazır' : 'Eksik var'}
          </StatusBadge>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <ReadyCard
            icon={<Mail size={16} />}
            title="E-posta (Gmail)"
            ok={gmailOk}
            detail={gmailOk ? connections?.email_varsayilan || 'Gmail hazır' : 'Gmail yapılandırılmadı'}
          />
          <ReadyCard
            icon={<MessageCircle size={16} />}
            title="WhatsApp (Cloud API)"
            ok={waOk}
            detail={
              waOk
                ? connections?.whatsapp_gonderim_acik
                  ? 'Yapılandırıldı · gönderim açık'
                  : 'Yapılandırıldı · gönderim kapalı'
                : 'WHATSAPP_TOKEN / PHONE_NUMBER_ID eksik'
            }
          />
          <ReadyCard
            icon={<CheckCircle2 size={16} />}
            title="Canlı gönderim izni"
            ok={sistemOk}
            detail={sistemOk ? 'OTOMATIK_TAHSILAT_ENABLED açık' : 'Sistem beklemede (env kapalı)'}
          />
        </div>
        {!sistemOk && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <p>
              Canlı otomatik gönderim için yönetici{' '}
              <code className="rounded bg-white px-1">OTOMATIK_TAHSILAT_ENABLED=true</code> +{' '}
              <code className="rounded bg-white px-1">CRON_SECRET</code> tanımlamalıdır. O zamana kadar
              deneme moduyla adayları görebilirsiniz.
            </p>
          </div>
        )}
      </section>

      {/* Blok 1: Otomatik Mutabakat */}
      <BlokKart
        renk="violet"
        icon={<Handshake size={18} />}
        baslik="Otomatik Mutabakat"
        aciklama="Uygun carilere zamanı gelince otomatik mutabakat e-postası (onay/itiraz linkli) gönderir."
        aktif={m.aktif}
        onAktif={(v) => patchM({ aktif: v })}
        taslak={m.taslak_mod}
        onTaslak={(v) => patchM({ taslak_mod: v })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Alan label="Taban bakiye (₺)" ipucu="Bu tutarın altındaki bakiyeli cariler girmez.">
            <input
              type="number"
              min={0}
              step={100}
              value={m.taban_bakiye || ''}
              onChange={(e) => patchM({ taban_bakiye: Math.max(0, Number(e.target.value) || 0) })}
              className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Alan>
          <Alan
            label="Sıklık"
            ipucu="Ayın ilk iş gününde çalışır; her cariye bu aralıkta bir kez (manuel gönderdiğin de sayılır)."
          >
            <select
              value={m.ay_araligi}
              onChange={(e) => patchM({ ay_araligi: Number(e.target.value) })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value={1}>Her ay</option>
              <option value={2}>Her 2 ayda bir</option>
              <option value={3}>Her 3 ayda bir</option>
            </select>
          </Alan>
        </div>
        <p className="text-xs text-slate-400">
          8 iş günü tekrar-gönderim engeli ve “alıcı e-posta seçili olma” şartı otomatik uygulanır.
        </p>
      </BlokKart>

      {/* Blok 2: Otomatik Ödeme Talebi */}
      <BlokKart
        renk="emerald"
        icon={<MessageCircle size={18} />}
        baslik="Otomatik Ödeme Talebi"
        aciklama="Ortalama gecikmesi eşiği aşan carilere otomatik ödeme talebi (WhatsApp / e-posta) gönderir."
        aktif={o.aktif}
        onAktif={(v) => patchO({ aktif: v })}
        taslak={o.taslak_mod}
        onTaslak={(v) => patchO({ taslak_mod: v })}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Alan label="Ort. gecikme eşiği (gün)">
            <input
              type="number"
              min={0}
              max={3650}
              value={o.min_ortalama_gecikme_gun}
              onChange={(e) =>
                patchO({ min_ortalama_gecikme_gun: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Alan>
          <Alan label="Taban gecikmiş (₺)">
            <input
              type="number"
              min={0}
              step={100}
              value={o.min_gecikmis_tutar || ''}
              onChange={(e) => patchO({ min_gecikmis_tutar: Math.max(0, Number(e.target.value) || 0) })}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Alan>
          <Alan label="Kanal">
            <select
              value={o.kanal}
              onChange={(e) => patchO({ kanal: e.target.value as OdemeTalepKanal })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="her-ikisi">WhatsApp + E-posta</option>
              <option value="whatsapp">Yalnız WhatsApp</option>
              <option value="email">Yalnız E-posta</option>
            </select>
          </Alan>
        </div>
        <FrekansSecici value={o.frekans} onChange={(frekans) => patchO({ frekans })} />
      </BlokKart>

      {/* Ortak: çalışma zamanı */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Clock3 size={16} className="text-brand-600" />
          Çalışma zamanı (her iki otomasyon için ortak)
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Çalışma saati (TR)</span>
            <input
              type="time"
              value={settings.calisma_saati}
              onChange={(e) => setSettings({ ...settings, calisma_saati: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={settings.sadece_is_gunu}
              onChange={(e) => setSettings({ ...settings, sadece_is_gunu: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Yalnızca iş günlerinde çalış
          </label>
        </div>
      </section>

      {/* Aksiyonlar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
          Ayarları kaydet
        </Button>
        <Button variant="secondary" onClick={() => runAutomation(true)} disabled={running}>
          {running ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={15} />}
          Deneme çalıştır (gönderme)
        </Button>
        <Button variant="success" onClick={() => runAutomation(false)} disabled={running}>
          <Send size={15} />
          Şimdi çalıştır
        </Button>
        <span className="ml-auto text-xs text-slate-400">
          “Şimdi çalıştır” yalnız deneme modu KAPALI blokları gerçekten gönderir.
        </span>
      </div>

      {lastRun && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800">Son çalıştırma özeti</h3>
          <p className="mt-1 text-xs text-slate-500">
            {lastRun.aday_sayisi} aday · {lastRun.gonderilen} gönderim · {lastRun.atlanan} atlandı
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
                    <th className="px-3 py-2">Tür</th>
                    <th className="px-3 py-2">Kanal</th>
                    <th className="px-3 py-2">Ort. gecikme</th>
                    <th className="px-3 py-2">Alıcı</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {lastRun.adaylar.slice(0, 30).map((aday) => (
                    <tr
                      key={`${aday.tur}-${aday.kanal}-${aday.cari_kod}`}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{aday.firma_adi}</p>
                        <p className="text-[11px] text-slate-400">{aday.cari_kod}</p>
                      </td>
                      <td className="px-3 py-2">
                        {aday.tur === 'mutabakat' ? 'Mutabakat' : 'Ödeme talebi'}
                      </td>
                      <td className="px-3 py-2 capitalize">{aday.kanal}</td>
                      <td className="px-3 py-2">
                        {aday.ortalama_gecikme_gun != null ? `${aday.ortalama_gecikme_gun} gün` : '—'}
                      </td>
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

function ReadyCard({
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

function BlokKart({
  renk,
  icon,
  baslik,
  aciklama,
  aktif,
  onAktif,
  taslak,
  onTaslak,
  children,
}: {
  renk: 'violet' | 'emerald'
  icon: React.ReactNode
  baslik: string
  aciklama: string
  aktif: boolean
  onAktif: (v: boolean) => void
  taslak: boolean
  onTaslak: (v: boolean) => void
  children: React.ReactNode
}) {
  const kenar = aktif
    ? renk === 'violet'
      ? 'border-violet-300'
      : 'border-emerald-300'
    : 'border-slate-200'
  const rozet = renk === 'violet' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'
  return (
    <section className={`rounded-xl border-2 bg-white p-5 ${kenar}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`rounded-lg p-2 ${rozet}`}>{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{baslik}</h3>
            <p className="mt-0.5 max-w-md text-xs text-slate-500">{aciklama}</p>
          </div>
        </div>
        {/* Bağımsız aç/kapa anahtarı */}
        <label className="inline-flex cursor-pointer items-center gap-2">
          <span className={`text-xs font-medium ${aktif ? 'text-emerald-700' : 'text-slate-400'}`}>
            {aktif ? 'Aktif' : 'Pasif'}
          </span>
          <span className="relative">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => onAktif(e.target.checked)}
              className="peer sr-only"
            />
            <span className="block h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
      </div>

      <div className={`mt-4 space-y-3 ${aktif ? '' : 'opacity-60'}`}>
        {children}
        <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <input
            type="checkbox"
            checked={taslak}
            onChange={(e) => onTaslak(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span className="text-sm">
            <span className="font-medium">Deneme modu</span>
            <span className="block text-[11px] text-slate-500">
              Açıkken GÖNDERMEZ, yalnız aday listesini çıkarır. Emin olunca kapatın → gerçek gönderim.
            </span>
          </span>
        </label>
      </div>
    </section>
  )
}

function Alan({
  label,
  ipucu,
  children,
}: {
  label: string
  ipucu?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {ipucu && <span className="mt-1 block text-[11px] text-slate-400">{ipucu}</span>}
    </label>
  )
}

const HAFTA_GUNLERI: Array<[number, string]> = [
  [1, 'Pazartesi'],
  [2, 'Salı'],
  [3, 'Çarşamba'],
  [4, 'Perşembe'],
  [5, 'Cuma'],
]

function FrekansSecici({ value, onChange }: { value: Frekans; onChange: (f: Frekans) => void }) {
  const inp = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm'
  const ozet =
    value.tur === 'gunluk'
      ? 'her (iş) gün'
      : value.tur === 'haftalik'
        ? `her hafta ${HAFTA_GUNLERI.find(([g]) => g === value.gun)?.[1] || ''}`
        : `her ay (ayın ${value.gun}. günü; hafta sonuna denk gelirse ilk iş günü)`
  return (
    <Alan label="Sıklık" ipucu={`Otomatik: ${ozet}.`}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value.tur}
          onChange={(e) => {
            const tur = e.target.value as Frekans['tur']
            let gun = value.gun
            if (tur === 'haftalik') gun = Math.min(5, Math.max(1, gun))
            else if (tur === 'aylik') gun = Math.min(28, Math.max(1, gun))
            onChange({ tur, gun })
          }}
          className={inp}
        >
          <option value="gunluk">Her gün</option>
          <option value="haftalik">Her hafta</option>
          <option value="aylik">Her ay</option>
        </select>
        {value.tur === 'haftalik' && (
          <select
            value={value.gun}
            onChange={(e) => onChange({ ...value, gun: Number(e.target.value) })}
            className={inp}
          >
            {HAFTA_GUNLERI.map(([g, ad]) => (
              <option key={g} value={g}>
                {ad}
              </option>
            ))}
          </select>
        )}
        {value.tur === 'aylik' && (
          <span className="flex items-center gap-1 text-sm text-slate-600">
            Ayın
            <input
              type="number"
              min={1}
              max={28}
              value={value.gun}
              onChange={(e) =>
                onChange({ ...value, gun: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })
              }
              className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            günü
          </span>
        )}
      </div>
    </Alan>
  )
}
