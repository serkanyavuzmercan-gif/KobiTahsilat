'use client'

import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
      className={cn(buttonVariants.ghost, 'px-2.5 py-2 text-sm sm:px-3')}
    >
      <LogOut size={15} />
      <span className="hidden sm:inline">Çıkış</span>
    </button>
  )
}
