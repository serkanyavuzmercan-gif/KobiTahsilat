'use client'

import { FormEvent, useState } from 'react'
import { AlertCircle, CheckCircle2, FileImage, LoaderCircle, Upload, X } from 'lucide-react'
import { formatTL } from '@/lib/types'

export function MutabakatItirazForm({
  token,
  firmaAdi,
  cariKod,
  bakiye,
  mutabakatTarihi,
}: {
  token: string
  firmaAdi: string
  cariKod: string
  bakiye: number
  mutabakatTarihi: string
}) {
  const [aciklama, setAciklama] = useState('')
  const [iletisim, setIletisim] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function selectFile(file: File | undefined) {
    setError('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Yalnızca PNG, JPG veya WEBP görsel yükleyebilirsiniz.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Ekran görüntüsü en fazla 4 MB olabilir.')
      return
    }
    const dataUrl = await readAsDataUrl(file)
    setScreenshot(dataUrl)
    setFileName(file.name)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (aciklama.trim().length < 10) {
      setError('Lütfen fark veya itiraz nedenini en az 10 karakterle açıklayın.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/mutabakat/itiraz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          aciklama: aciklama.trim(),
          iletisim: iletisim.trim(),
          screenshotBase64: screenshot,
        }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'İtiraz gönderilemedi.')
      setSuccess(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İtiraz gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-600" size={52} />
        <h2 className="mt-4 text-2xl font-semibold">Bildiriminiz alındı</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          Fark/itiraz açıklamanız <strong>Hidroteknik A.Ş.</strong> ekibine iletildi. İnceleme
          sonrasında sizinle iletişime geçilecektir.
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-slate-400">
          Bu pencereyi güvenle kapatabilirsiniz.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
          Cari hesap mutabakatı
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Fark / itiraz bildirimi</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Kayıtlarımızla sizin kayıtlarınız arasındaki farkı açıklayabilir ve destekleyici ekran
          görüntüsü ekleyebilirsiniz.
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
          <Info label="Firma" value={firmaAdi} />
          <Info label="Cari kod" value={cariKod} />
          <Info label="Bildirilen bakiye" value={formatTL(bakiye)} />
        </div>
        <p className="mt-2 text-xs text-slate-400">Mutabakat tarihi: {mutabakatTarihi}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            {error}
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Fark veya itiraz nedeni *</span>
          <textarea
            value={aciklama}
            onChange={(event) => setAciklama(event.target.value)}
            required
            minLength={10}
            maxLength={5000}
            rows={7}
            placeholder="Örneğin: 12.07.2026 tarihli ödemeniz kayıtlarımızda görünmüyor…"
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="mt-1 block text-right text-xs text-slate-400">{aciklama.length}/5000</span>
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">İletişim bilgisi</span>
          <input
            value={iletisim}
            onChange={(event) => setIletisim(event.target.value)}
            maxLength={250}
            placeholder="E-posta veya telefon (isteğe bağlı)"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>

        <div className="mt-5">
          <p className="text-sm font-medium text-slate-700">Ekran görüntüsü</p>
          {!screenshot ? (
            <label className="mt-2 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center hover:border-brand-400 hover:bg-brand-50">
              <Upload size={26} className="text-brand-600" />
              <span className="mt-2 text-sm font-medium">Ekran görüntüsü seçin</span>
              <span className="mt-1 text-xs text-slate-400">PNG, JPG veya WEBP · En fazla 4 MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
            </label>
          ) : (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <FileImage size={19} className="shrink-0 text-brand-600" />
                  <span className="truncate">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScreenshot(null)
                    setFileName('')
                  }}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                  aria-label="Görseli kaldır"
                >
                  <X size={18} />
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="Yüklenecek ekran görüntüsü"
                className="mt-3 max-h-72 w-full rounded-lg object-contain"
              />
            </div>
          )}
        </div>

        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="animate-spin" size={20} /> : 'Fark / itiraz bildirimini gönder'}
        </button>
      </section>
    </form>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Görsel okunamadı.'))
    reader.readAsDataURL(file)
  })
}
