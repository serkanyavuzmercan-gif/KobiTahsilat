'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import './login.css'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const email = username.includes('@')
        ? username.trim()
        : `${username.trim()}@hidroteknik.com.tr`

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError || !data.user) {
        setError(
          loginError?.message === 'Invalid login credentials'
            ? 'Geçersiz kullanıcı adı veya şifre.'
            : loginError?.message || 'Giriş yapılamadı.'
        )
        setLoading(false)
        return
      }

      // ss ile aynı yetki kontrolü: aktif personel + servis erişimi.
      const { data: personel, error: personelError } = await supabase
        .from('personel')
        .select('aktif, erisim_servis')
        .eq('user_id', data.user.id)
        .single()

      if (personelError || !personel) {
        await supabase.auth.signOut()
        setError('Personel kaydı bulunamadı.')
        setLoading(false)
        return
      }

      if (!personel.aktif || !personel.erisim_servis) {
        await supabase.auth.signOut()
        setError('Bu sisteme erişim yetkiniz yok.')
        setLoading(false)
        return
      }

      window.location.href = '/'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Giriş sırasında hata oluştu.')
      setLoading(false)
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
            <span className="gradient-text">KobiTahsilat</span>
          </h1>
          <p className="login-subtitle">Açık alacaklarınızı tek ekrandan yönetin</p>
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

        {/* Footer */}
        <div className="login-footer">
          <p>ss ile aynı Supabase Auth ve personel yetkileri kullanılır.</p>
          <p style={{ marginTop: 6 }}>Hidroteknik A.Ş. © 2026</p>
        </div>
      </div>
    </div>
  )
}
