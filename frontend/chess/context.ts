"use client"

import { createContext, use } from "react"
import type { ChessState } from "./store"
import type { Position } from "./core/position"
import type { PieceType } from "./core/piece"

export interface ChessContextValue {
  state: ChessState
  makeMove: (from: Position, to: Position) => void
  select: (position: Position | null) => void
  clearSelection: () => void
  confirmPromotion: (promoteTo: PieceType) => void
  cancelPromotion: () => void
}

export const ChessContext = createContext<ChessContextValue | null>(null)

export function useChess(): ChessContextValue {
  const context = use(ChessContext)
  if (context === null) {
    throw new Error("useChess must be used within a ChessProvider")
  }
  return context
}
