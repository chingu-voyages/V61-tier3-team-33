"use client"

import { useReducer, useCallback } from "react"
import { gameReducer, GameContext } from "./use-game"
import { FEN } from "@/lib/core/fen"
import { Board } from "@/lib/core/board"

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

const InitialGameState = {
  board: FEN.boardFromFEN(STARTING_FEN) ?? Board.create(),
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, InitialGameState)

  const load = useCallback((fen: string) => {
    const board = FEN.boardFromFEN(fen)
    if (board) {
      dispatch({ type: "LOAD_POSITION", board })
    }
  }, [])

  return (
    <GameContext.Provider value={{ state, load }}>
      {children}
    </GameContext.Provider>
  )
}
