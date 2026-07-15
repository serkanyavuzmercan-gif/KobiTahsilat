'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type HatirlatmaMessageContextValue = {
  body: string
  defaultBody: string
  isEdited: boolean
  setBody: (value: string) => void
  reset: () => void
}

const HatirlatmaMessageContext = createContext<HatirlatmaMessageContextValue | null>(null)

export function HatirlatmaMessageProvider({
  defaultBody,
  children,
}: {
  defaultBody: string
  children: ReactNode
}) {
  const [body, setBodyState] = useState(defaultBody)

  const value = useMemo<HatirlatmaMessageContextValue>(() => {
    const setBody = (next: string) => setBodyState(next)
    const reset = () => setBodyState(defaultBody)
    return {
      body,
      defaultBody,
      isEdited: body !== defaultBody,
      setBody,
      reset,
    }
  }, [body, defaultBody])

  return (
    <HatirlatmaMessageContext.Provider value={value}>{children}</HatirlatmaMessageContext.Provider>
  )
}

export function useHatirlatmaMessage() {
  const context = useContext(HatirlatmaMessageContext)
  if (!context) {
    throw new Error('useHatirlatmaMessage yalnızca HatirlatmaMessageProvider içinde kullanılabilir.')
  }
  return context
}
