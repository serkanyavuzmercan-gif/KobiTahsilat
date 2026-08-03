import { headers } from 'next/headers'
import { LoginForm } from '@/components/login-form'
import './login.css'

export const dynamic = 'force-dynamic'

/**
 * Giriş ekranı — bilinçli olarak RESMİ ve CAYDIRICI.
 * Altyapı/kullanıcı-adı formatı gibi ipucu VERİLMEZ; ziyaretçiye kendi IP'si gösterilir ve
 * tüm denemelerin kayıt altına alındığı açıkça belirtilir.
 */
export default async function LoginPage() {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'tespit edilemedi'

  return <LoginForm ip={ip} />
}
