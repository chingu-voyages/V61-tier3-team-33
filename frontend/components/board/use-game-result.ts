import { useMemo } from "react"
import type { RoomState } from "@/context/room/reducer"
import { FINISHED } from "@/socket/types"
import { DRAW } from "@/core/game"
import { Reason } from "@/core/reason"

export function useGameResult(state: RoomState) {
  const isFinished = state.status === FINISHED && state.result !== null

  const resultText = useMemo(() => {
    if (!state.result || state.color === null) return ""
    const { hasWinner, winner, status, drawReason } = state.result
    if (hasWinner) {
      const iWon = winner === state.color
      return iWon ? "You won!" : "Opponent won!"
    }
    if (status === DRAW) {
      return Reason.drawLabel(drawReason)
    }
    return "Game Over"
  }, [state.result, state.color])

  return { isFinished, resultText }
}
