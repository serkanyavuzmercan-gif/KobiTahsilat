'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, ShieldAlert, User } from 'lucide-react'
import { APP_VERSION } from '@/lib/app-version'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

declare global {
  interface Window {
    turnstile?: { reset: (id?: string) => void }
  }
}

export function LoginForm({ ip }: { ip: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /**
   * Giriş SUNUCUDA doğrulanır (/api/auth/giris): brute-force kilidi + CAPTCHA orada uygulanır,
   * deneme kaydı sahtelenemez. Oturum çerezleri de o route'ta set edilir.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const form = event.currentTarget
    const captchaToken =
      (form.elements.namedItem('cf-turnstile-response') as HTMLInputElement | null)?.value || ''

    try {
      const res = await fetch('/api/auth/giris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, captchaToken }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        setError(json.error || 'Giriş yapılamadı.')
        setLoading(false)
        window.turnstile?.reset()
        return
      }

      window.location.href = '/'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Giriş sırasında hata oluştu.')
      setLoading(false)
      window.turnstile?.reset()
    }
  }

  return (
    <div className="login-container">
      <div className="scanlines" aria-hidden />

      {/* Üst uyarı bandı */}
      <div className="top-banner">
        <ShieldAlert size={15} />
        <span>KISITLI SİSTEM — YALNIZCA YETKİLİ PERSONEL</span>
      </div>

      <div className="login-card">
        <div className="login-header">
          <img
            src="https://files.cdn-files-a.com/uploads/5644137/400_6865986816fbc.png"
            alt="Hidroteknik"
            className="logo"
          />
          <h1 className="login-title">Mutabakat ve Tahsilat Sistemi</h1>
          <p className="login-subtitle">{APP_VERSION}</p>
        </div>

        {/* Güvenlik ihtarı */}
        <div className="security-notice">
          <div className="notice-head">
            <AlertTriangle size={14} />
            GÜVENLİK İHTARI
          </div>
          <ul>
            <li>
              Bu sistem <strong>mali verilere</strong> erişim sağlar ve sürekli izlenmektedir.
            </li>
            <li>
              Tüm giriş denemeleri <strong>IP adresi, tarih ve saat</strong> ile kayıt altına alınır.
            </li>
            <li>
              Başarısız denemeler <strong>otomatik olarak engellenir</strong> ve bilgi işleme bildirilir.
            </li>
            <li>
              Yetkisiz erişim girişimi <strong>TCK 243/244</strong> uyarınca suç teşkil eder ve
              hakkında <strong>hukuki işlem başlatılır</strong>.
            </li>
          </ul>
        </div>

        {/* Ziyaretçinin kendi IP'si — caydırıcı ve gerçek */}
        <div className="ip-badge">
          <span className="ip-label">KAYIT ALTINDA</span>
          <span className="ip-value">IP: {ip}</span>
        </div>

        {error && (
          <div className="error-message">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              <User size={14} />
              Kullanıcı
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              <Lock size={14} />
              Şifre
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* CAPTCHA — yalnız site anahtarı tanımlıysa görünür */}
          {TURNSTILE_SITE_KEY && (
            <>
              {/* eslint-disable-next-line @next/next/no-sync-scripts */}
              <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              <div
                className="cf-turnstile"
                data-sitekey={TURNSTILE_SITE_KEY}
                data-theme="dark"
                style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}
              />
            </>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            <span className="btn-text" style={{ opacity: loading ? 0 : 1 }}>
              GİRİŞ YAP
            </span>
            {loading && (
              <div className="btn-loader">
                <div className="spinner"></div>
              </div>
            )}
          </button>

          <div className="forgot-password">
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => {
                window.open('https://crm.hidroteknik.com.tr', '_blank')
              }}
            >
              <KeyRound size={13} />
              Şifremi Unuttum
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>Hidroteknik A.Ş. · Bilgi İşlem</p>
        </div>
      </div>
    </div>
  )
}
