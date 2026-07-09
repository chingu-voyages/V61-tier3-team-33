"use client"

import { createContext, use } from "react"
import type { RoomState } from "./reducer"
import type { GameActions } from "@/socket/use-action"

export interface RoomContextValue {
  state: RoomState
  actions: GameActions
}

export const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom(): RoomContextValue {
  const context = use(RoomContext)
  if (context === null) {
    throw new Error("useRoom must be used within a RoomProvider")
  }
  return context
}