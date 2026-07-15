import { useState } from "react"
import type { RoomState } from "@/context/room/reducer"
import type { ViewAction } from "./view-reducer"

export function useUndoRequest(
  state: RoomState,
  dispatch: React.Dispatch<ViewAction>
) {
  const showUndoRequest =
    state.pendingUndo !== null && state.pendingUndo.by !== state.color

  const isMyUndoPending = state.pendingUndo?.by === state.color

  const [prevExpiresAt, setPrevExpiresAt] = useState(
    state.pendingUndo?.expiresAt
  )

  // Reset opponent agreement whenever a *new* undo request arrives.
  // Adjusted during render (no Effect needed) — see "You Might Not Need
  // an Effect" > Adjusting some state when a prop changes.
  if (state.pendingUndo && state.pendingUndo.expiresAt !== prevExpiresAt) {
    setPrevExpiresAt(state.pendingUndo.expiresAt)
    dispatch({ type: "RESET_OPPONENT_AGREEMENT" })
  }

  return { showUndoRequest, isMyUndoPending }
}
