'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Adim = 'baslangic' | 'qr' | 'bitti'

export function MfaKurulum({ kurulu }: { kurulu: boolean }) {
  const router = useRouter()
  const [adim, setAdim] = useState<Adim>(kurulu ? 'bitti' : 'baslangic')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function baslat() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa/kur', { method: 'POST' })
      const j = (await res.json()) as {
        success?: boolean
        qr?: string
        secret?: string
        factorId?: string
        error?: string
      }
      if (!j.success) throw new Error(j.error || 'Kurulum başlatılamadı.')
      setQr(j.qr || '')
      setSecret(j.secret || '')
      setFactorId(j.factorId || '')
      setAdim('qr')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function dogrula() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa/dogrula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, factorId }),
      })
      const j = (await res.json()) as { success?: boolean; error?: string }
      if (!j.success) throw new Error(j.error || 'Kod doğrulanamadı.')
      setAdim('bitti')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  if (adim === 'bitti') {
    return (
      <section className="card border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <h3 className="font-semibold text-emerald-900">İki adımlı doğrulama aktif</h3>
            <p className="mt-1 text-sm text-emerald-800">
              Bundan sonra her girişte şifrenizin ardından telefonunuzdaki 6 haneli kod istenecek.
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Telefonunuzu kaybederseniz bilgi işlem kaydınızı sıfırlayabilir.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="card p-6">
      {adim === 'baslangic' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Smartphone size={20} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Nasıl çalışır?</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                <li>Telefonunuza bir doğrulayıcı uygulama kurun (Google Authenticator, Microsoft Authenticator).</li>
                <li>Aşağıdaki QR kodunu uygulamayla okutun.</li>
                <li>Uygulamada çıkan 6 haneli kodu girip doğrulayın.</li>
              </ol>
            </div>
          </div>
          <Button onClick={baslat} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            Kuruluma başla
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {adim === 'qr' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            QR kodunu doğrulayıcı uygulamanızla okutun, ardından uygulamada görünen kodu girin.
          </p>
          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr}
              alt="QR kodu"
              width={190}
              height={190}
              className="rounded-lg border border-slate-200 bg-white p-2"
            />
          )}
          {secret && (
            <p className="text-xs text-slate-500">
              QR okutamıyorsanız bu anahtarı elle girin:{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">{secret}</code>
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={dogrula} disabled={busy || code.length !== 6}>
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Doğrula ve etkinleştir
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </section>
  )
}
