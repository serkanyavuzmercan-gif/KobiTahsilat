'use client'

import { FormEvent, useState } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

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
        return
      }

      if (!personel.aktif || !personel.erisim_servis) {
        await supabase.auth.signOut()
        setError('Bu sisteme erişim yetkiniz yok.')
        return
      }

      window.location.href = '/'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Giriş sırasında hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <section className="card w-full p-7 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <LockKeyhole size={24} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold">KobiTahsilat</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hidroteknik hesabınızla güvenli giriş yapın
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Kullanıcı adı
            </label>
            <div className="flex rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-brand-500">
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
                className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm outline-none"
                placeholder="kullanici.adi"
              />
              {!username.includes('@') && (
                <span className="flex items-center border-l border-slate-200 px-2 text-xs text-slate-400">
                  @hidroteknik.com.tr
                </span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Şifre
            </label>
            <div className="flex rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-brand-500">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm outline-none"
                placeholder="Şifreniz"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="px-3 text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <LoaderCircle className="animate-spin" size={20} /> : 'Giriş Yap'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          ss ile aynı Supabase Auth ve personel yetkileri kullanılır.
        </p>
      </section>
    </div>
  )
}
