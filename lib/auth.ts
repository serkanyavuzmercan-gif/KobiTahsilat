import 'server-only'
import { createServerSupabaseClient } from './supabase/server'

export async function requireAuthUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Oturum açmanız gerekiyor.')
  return user
}
