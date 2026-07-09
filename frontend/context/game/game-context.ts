"use client"

import { createContext, use } from "react"
import type { GameState } from "./game-reducer"
import type { GameActions } from "@/socket/use-action"

export interface GameContextValue {
  state: GameState
  actions: GameActions
}

export const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const context = use(GameContext)
  if (context === null) {
    throw new Error("useGame must be used within a GameProvider")
  }
  return context
}
