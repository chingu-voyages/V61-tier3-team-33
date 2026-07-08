"use client"

import { createContext, use } from "react"

export interface SessionInfo {
  playerId: string
  token: string
}

export const SessionContext = createContext<SessionInfo | null>(null)

export function useSession(): SessionInfo {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error("useSession must be used within SessionProvider")
  return ctx
}
