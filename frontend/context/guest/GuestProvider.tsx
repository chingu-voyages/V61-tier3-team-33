"use client"

import { createContext, use, useCallback, useState } from "react"

interface GuestContextValue {
  isGuest: boolean
  setGuest: () => void
  clearGuest: () => void
}

const GuestContext = createContext<GuestContextValue>({
  isGuest: false,
  setGuest: () => {},
  clearGuest: () => {},
})

function getGuestCookie(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith("guest=true"))
}

function setGuestCookie(): void {
  document.cookie =
    "guest=true; path=/; sameSite=lax; max-age=86400"
}

function clearGuestCookie(): void {
  document.cookie =
    "guest=; path=/; sameSite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT"
}

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [isGuest, setGuestState] = useState(getGuestCookie)

  const setGuest = useCallback(() => {
    setGuestCookie()
    setGuestState(true)
  }, [])

  const clearGuest = useCallback(() => {
    clearGuestCookie()
    setGuestState(false)
  }, [])

  return (
    <GuestContext.Provider
      value={{ isGuest, setGuest, clearGuest }}
    >
      {children}
    </GuestContext.Provider>
  )
}

export function useGuest(): GuestContextValue {
  return use(GuestContext)
}
