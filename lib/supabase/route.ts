import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Route Handler içinde kullanılan Supabase istemcisi.
 * Server Component'ten farkı: çerez YAZABİLİR (giriş / MFA doğrulaması oturumu günceller).
 */
export async function createRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase yapılandırılmadı')

  const cookieStore = await cookies()
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(list) {
        list.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options)
          } catch {
            /* yoksay */
          }
        })
      },
    },
  })
}
