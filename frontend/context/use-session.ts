"use client"

import { createContext, use } from "react"

import type { SessionState } from "./session-reducer"

export interface SessionContextValue {
  state: SessionState
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const context = use(SessionContext)
  if (context === null) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}
