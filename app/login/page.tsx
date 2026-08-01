'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, User } from 'lucide-react'
import { APP_VERSION } from '@/lib/app-version'
import './login.css'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

declare global {
  interface Window {
    turnstile?: { reset: (id?: string) => void }
  }
}

export default function LoginPage() {
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
      {/* Animated background elements */}
      <div className="floating-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>

      <div className="login-card">
        {/* Header with logo */}
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-glow"></div>
            <img
              src="https://files.cdn-files-a.com/uploads/5644137/400_6865986816fbc.png"
              alt="Hidroteknik Logo"
              className="logo"
            />
          </div>
          <h1 className="login-title">
            <span className="gradient-text">Mutabakat ve Tahsilat Sistemi</span>
          </h1>
          <p className="login-subtitle" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            {APP_VERSION}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="error-message" style={{ display: 'flex' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              <User size={14} />
              Kullanıcı Adı
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="kullanici.adi"
              />
              {!username.includes('@') && (
                <span className="domain-suffix">@hidroteknik.com.tr</span>
              )}
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
                placeholder="Şifrenizi girin"
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

          {/* CAPTCHA — yalnız site anahtarı tanımlıysa görünür (kademeli devreye alma) */}
          {TURNSTILE_SITE_KEY && (
            <>
              {/* eslint-disable-next-line @next/next/no-sync-scripts */}
              <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              <div
                className="cf-turnstile"
                data-sitekey={TURNSTILE_SITE_KEY}
                data-theme="light"
                style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}
              />
            </>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            <span className="btn-text" style={{ opacity: loading ? 0 : 1 }}>
              Giriş Yap
            </span>
            {loading && (
              <div className="btn-loader">
                <div className="spinner"></div>
              </div>
            )}
          </button>

          <p className="text-xs text-gray-400 mt-2 text-center">
            Oturumunuz 30 gün süreyle saklanır.
          </p>

          {/* Forgot Password Link */}
          <div className="forgot-password">
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => {
                window.open('https://crm.hidroteknik.com.tr', '_blank')
              }}
            >
              <KeyRound size={14} />
              Şifremi Unuttum
            </button>
          </div>
        </form>

        {/* Footer — altyapı/yetki bilgisi VERİLMEZ (saldırgana ipucu olmasın). */}
        <div className="login-footer">
          <p>Hidroteknik A.Ş. © 2026</p>
        </div>
      </div>
    </div>
  )
}
