'use client'

import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AuthActions() {
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100"
    >
      <LogOut size={15} />
      <span className="hidden sm:inline">Çıkış</span>
    </button>
  )
}
