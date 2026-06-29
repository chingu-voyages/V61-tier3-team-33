"use client"

import type { Board } from "@/lib/core/board"
import { createContext, use } from "react"

export type GameState = {
  board: Board
}

export type GameAction = { type: "LOAD_POSITION"; board: Board }

export function gameReducer(state: GameState, action: GameAction) {
  switch (action.type) {
    case "LOAD_POSITION":
      return { board: action.board }
    default:
      return state
  }
}

type GameContextValue = {
  state: GameState
  load(str: string): void
}

export const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const context = use(GameContext)
  if (context === null) {
    throw new Error("useGame must be used within a GameContext")
  }
  return context
}
