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
import { formatTL } from '@/lib/types'
import type {
  AutomationConnectionsStatus,
  AutomationRunCandidate,
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
  // Gerçek gönderim öncesi son teyid modu (önizle → onayla → gönder).
  const [onayBekliyor, setOnayBekliyor] = useState(false)

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
        // "Şimdi çalıştır" her zaman gün/frekans/saat kapılarını atlar (force);
        // gönderim/önizleme kararını ortak Deneme modu (dryRun) verir. Dönem kilidi yine geçerli.
        body: JSON.stringify({ dryRun, force: true }),
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
  // Tek, ortak deneme modu (her iki blok birlikte).
  const denemeAcik = m.taslak_mod || o.taslak_mod

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
            detail={sistemOk ? 'Açık' : 'Henüz açık değil (yönetici açacak)'}
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
        aciklama="Seçtiğin sıklıkta, uygun carilere otomatik mutabakat e-postası gönderir."
        aktif={m.aktif}
        onAktif={(v) => patchM({ aktif: v })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Alan label="Taban bakiye (₺)" ipucu="Bakiyesi bundan az olanlara gönderilmez.">
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
            ipucu="Her cariye bu aralıkta bir kez gönderilir. Elle gönderdiğin de sayılır."
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
          Alıcı e-postası seçili olmayan carilere gönderilmez.
        </p>
      </BlokKart>

      {/* Blok 2: Otomatik Ödeme Talebi */}
      <BlokKart
        renk="emerald"
        icon={<MessageCircle size={18} />}
        baslik="Otomatik Ödeme Talebi"
        aciklama="Çok geciken carilere otomatik ödeme hatırlatması (WhatsApp / e-posta) gönderir."
        aktif={o.aktif}
        onAktif={(v) => patchO({ aktif: v })}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Alan label="Ort. gecikme eşiği (gün)" ipucu="Ortalama gecikmesi bu günü geçenlere.">
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
          <Alan label="Taban gecikmiş (₺)" ipucu="Gecikmişi bundan az olana gönderilmez.">
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

        {/* Tek, ortak Deneme modu — her iki otomasyonu birlikte yönetir */}
        <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={m.taslak_mod || o.taslak_mod}
            onChange={(e) => {
              setOnayBekliyor(false)
              setSettings({
                ...settings,
                mutabakat: { ...settings.mutabakat, taslak_mod: e.target.checked },
                odeme_talebi: { ...settings.odeme_talebi, taslak_mod: e.target.checked },
              })
            }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-800">Deneme modu (güvenli mod)</span>
            <span className="block text-[11px] text-slate-600">
              Açıkken <strong>hiçbir mesaj gönderilmez</strong> — otomatik çalışma da, aşağıdaki
              “Şimdi çalıştır” da yalnızca kimlere gideceğini listeler. Gerçekten göndermek için kapatın.
            </span>
          </span>
        </label>
      </section>

      {/* Aksiyonlar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
          Ayarları kaydet
        </Button>
        {denemeAcik ? (
          <Button variant="secondary" onClick={() => runAutomation(true)} disabled={running}>
            {running ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={15} />}
            Şimdi çalıştır (deneme — göndermez)
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={async () => {
              // Önce önizleme (deneme) çıkar, sonra SON TEYİD panelini aç.
              await runAutomation(true)
              setOnayBekliyor(true)
            }}
            disabled={running}
          >
            {running ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={15} />}
            Önizle ve gönder
          </Button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {denemeAcik
            ? 'Deneme modu açık — sadece liste çıkar, gönderim olmaz.'
            : 'Önce önizleme çıkar, son teyidden sonra gönderilir.'}
        </span>
      </div>

      {/* SON TEYİD paneli — gerçek gönderimden hemen önce */}
      {onayBekliyor && !denemeAcik && lastRun && (
        <SonTeyidPaneli
          adaylar={lastRun.adaylar}
          gonderiliyor={running}
          onVazgec={() => setOnayBekliyor(false)}
          onOnayla={async () => {
            setOnayBekliyor(false)
            await runAutomation(false)
          }}
        />
      )}

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
              <table className="min-w-[860px] w-full text-left text-sm">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Firma</th>
                    <th className="px-3 py-2">Tür</th>
                    <th className="px-3 py-2">Kanal</th>
                    <th className="px-3 py-2 text-right">Bakiye</th>
                    <th className="px-3 py-2 text-right">Gecikmiş</th>
                    <th className="px-3 py-2 text-right">Ort. gecikme</th>
                    <th className="px-3 py-2">Alıcı</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {lastRun.adaylar.map((aday, i) => (
                    <tr
                      key={`${aday.tur}-${aday.kanal}-${aday.cari_kod}`}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-slate-100/70'}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{aday.firma_adi}</p>
                        <p className="text-[11px] text-slate-400">{aday.cari_kod}</p>
                      </td>
                      <td className="px-3 py-2">
                        {aday.tur === 'mutabakat' ? (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                            Mutabakat
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            Ödeme talebi
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize">{aday.kanal}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatTL(aday.bakiye)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-700">
                        {formatTL(aday.gecikmis_bakiye)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
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
  children,
}: {
  renk: 'violet' | 'emerald'
  icon: React.ReactNode
  baslik: string
  aciklama: string
  aktif: boolean
  onAktif: (v: boolean) => void
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

      <div className={`mt-4 space-y-3 ${aktif ? '' : 'opacity-60'}`}>{children}</div>
    </section>
  )
}

function SonTeyidPaneli({
  adaylar,
  gonderiliyor,
  onOnayla,
  onVazgec,
}: {
  adaylar: AutomationRunCandidate[]
  gonderiliyor: boolean
  onOnayla: () => void
  onVazgec: () => void
}) {
  const gidecek = adaylar.filter((a) => !a.engel)
  const mutabakatMail = gidecek.filter((a) => a.tur === 'mutabakat').length
  const odemeWa = gidecek.filter((a) => a.tur === 'odeme_talebi' && a.kanal === 'whatsapp').length
  const odemeMail = gidecek.filter((a) => a.tur === 'odeme_talebi' && a.kanal === 'email').length
  const toplam = gidecek.length

  const ilkMail = gidecek.find((a) => a.kanal === 'email')
  const ilkWa = gidecek.find((a) => a.kanal === 'whatsapp')
  const [mailOnizleme, setMailOnizleme] = useState<{
    firma: string
    alici: string | null
    subject: string
    html: string
  } | null>(null)
  const [waOnizleme, setWaOnizleme] = useState<{ firma: string; alici: string | null; text: string } | null>(null)
  const [onizlemeYukleniyor, setOnizlemeYukleniyor] = useState(true)

  useEffect(() => {
    let iptal = false
    async function yukle() {
      setOnizlemeYukleniyor(true)
      try {
        if (ilkMail) {
          const r = await fetch(
            `/api/otomasyon/onizle?cariKod=${encodeURIComponent(ilkMail.cari_kod)}&tur=${ilkMail.tur}&kanal=email`
          )
          const j = await r.json()
          if (!iptal && j.success) setMailOnizleme({ firma: j.firma, alici: j.alici, subject: j.subject, html: j.html })
        }
        if (ilkWa) {
          const r = await fetch(
            `/api/otomasyon/onizle?cariKod=${encodeURIComponent(ilkWa.cari_kod)}&tur=odeme_talebi&kanal=whatsapp`
          )
          const j = await r.json()
          if (!iptal && j.success) setWaOnizleme({ firma: j.firma, alici: j.alici, text: j.text })
        }
      } finally {
        if (!iptal) setOnizlemeYukleniyor(false)
      }
    }
    void yukle()
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ilkMail?.cari_kod, ilkWa?.cari_kod])

  return (
    <section className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
        <AlertTriangle size={18} />
        SON TEYİD — gerçekten gönderilecek
      </div>
      <p className="mt-2 text-sm text-slate-700">
        Aşağıdaki <strong>{toplam}</strong> carie <strong>gerçekten</strong> mesaj gönderilecek. Bu işlem
        <strong> geri alınamaz.</strong>
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-700">
          {mutabakatMail} mutabakat e-posta
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
          {odemeWa} ödeme WhatsApp
        </span>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
          {odemeMail} ödeme e-posta
        </span>
      </div>
      {odemeWa > 250 && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900">
          ⚠️ {odemeWa} WhatsApp, Meta’nın günlük 250 sınırını aşıyor olabilir — 250’den sonrakiler hata
          dönebilir. E-postalar bu sınırdan etkilenmez.
        </p>
      )}
      {/* GERÇEK İÇERİK ÖNİZLEMESİ — ilk gidecek mail + WhatsApp */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Gidecek mesajın örneği (ilk kayıt)
        </p>
        {onizlemeYukleniyor && !mailOnizleme && !waOnizleme ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="animate-spin" size={15} /> Önizleme hazırlanıyor…
          </p>
        ) : (
          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            {mailOnizleme && (
              <div>
                <p className="text-xs text-slate-500">
                  <Mail size={12} className="mr-1 inline text-brand-600" />
                  <strong>{mailOnizleme.firma}</strong> → {mailOnizleme.alici || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  <span className="text-slate-400">Konu:</span> {mailOnizleme.subject}
                </p>
                <iframe
                  sandbox=""
                  srcDoc={mailOnizleme.html}
                  title="Mail önizleme"
                  className="mt-1.5 h-80 w-full rounded-lg border border-slate-200 bg-white"
                />
              </div>
            )}
            {waOnizleme && (
              <div>
                <p className="text-xs text-slate-500">
                  <MessageCircle size={12} className="mr-1 inline text-emerald-600" />
                  <strong>{waOnizleme.firma}</strong> → {waOnizleme.alici || '—'}
                </p>
                <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800 shadow-sm ring-1 ring-emerald-100">
                    {waOnizleme.text}
                  </div>
                  <p className="mt-1.5 text-[11px] text-emerald-700">
                    Meta onaylı şablon · her firma için ad/tutar/link otomatik dolar.
                  </p>
                </div>
              </div>
            )}
            {!mailOnizleme && !waOnizleme && (
              <p className="text-sm text-slate-400">Gösterilecek hazır kayıt yok.</p>
            )}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">
          Not: içerik firmaya göre değişir (ad, bakiye, tutar, link). Bu yalnızca listedeki ilk kaydın örneğidir.
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Tam gidecek liste yukarıdaki “Son çalıştırma özeti” tablosunda (durumu <strong>Hazır</strong> olanlar).
        Engelli/atlanan satırlara gönderilmez.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="success" onClick={onOnayla} disabled={gonderiliyor || toplam === 0}>
          {gonderiliyor ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
          Onayla ve {toplam} carie gönder
        </Button>
        <Button variant="secondary" onClick={onVazgec} disabled={gonderiliyor}>
          Vazgeç
        </Button>
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
