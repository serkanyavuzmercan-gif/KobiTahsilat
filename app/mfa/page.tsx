'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import '../login/login.css'

/**
 * GİRİŞ 2. ADIM — doğrulayıcı kodu.
 * Kullanıcının doğrulanmış TOTP faktörü varsa proxy.ts buraya yönlendirir; kod doğrulanana kadar
 * (oturum aal2 olana kadar) hiçbir finans ekranına erişilemez.
 */
export default function MfaPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa/dogrula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || 'Kod doğrulanamadı.')
        setCode('')
        setLoading(false)
        return
      }
      window.location.href = '/'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Doğrulama başarısız.')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="scanlines" aria-hidden />
      <div className="top-banner">
        <ShieldCheck size={15} />
        <span>İKİ ADIMLI DOĞRULAMA</span>
      </div>

      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Doğrulayıcı Kodu</h1>
          <p className="login-subtitle" style={{ letterSpacing: 0, fontFamily: 'inherit', fontSize: 12 }}>
            Telefonunuzdaki doğrulayıcı uygulamasında görünen 6 haneli kodu girin.
          </p>
        </div>

        {error && (
          <div className="error-message">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <div className="input-wrapper">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{
                  textAlign: 'center',
                  fontSize: 26,
                  letterSpacing: '0.4em',
                  padding: '14px 13px',
                }}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading || code.length !== 6}>
            <span className="btn-text" style={{ opacity: loading ? 0 : 1 }}>
              DOĞRULA
            </span>
            {loading && (
              <div className="btn-loader">
                <div className="spinner"></div>
              </div>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Kodunuza erişemiyorsanız bilgi işlem ile iletişime geçin.</p>
        </div>
      </div>
    </div>
  )
}
