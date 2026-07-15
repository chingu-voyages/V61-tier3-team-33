import { useEffect } from "react"
import type { Phase } from "./types"
import type { Action } from "./play-reducer"
import type { RoomContextValue } from "@/context/room/context"
import { useSocketEvent } from "@/socket/use-event"
import { GAME_STARTED, ROOM_JOINED } from "@/socket/events"
import { ACTIVE, FINISHED } from "@/socket/types"
import { gooeyToast } from "@/components/ui/goey-toaster"

function hasGameStarted(status: number | null): boolean {
  return status === ACTIVE
}

export function useRoomSync(
  room: RoomContextValue,
  phase: Phase,
  dispatch: React.Dispatch<Action>,
  modeExplicit = false,
  pendingCreateRef?: { current: boolean }
) {
  // Reconnection: room:joined may have already fired before this component
  // mounted (e.g. user closed tab, reopened, navigated to /play). Check the
  // existing room state and transition to play if in an active or finished game.
  // Only fires when the user didn't explicitly choose a mode (no ?mode= param),
  // so "Play a Friend" / "Play Online" links show the time picker as expected.
  useEffect(() => {
    if (modeExplicit) return
    if (
      phase.phase === "pick-time" &&
      room.state.roomId &&
      room.state.color !== null &&
      (room.state.status === ACTIVE || room.state.status === FINISHED)
    ) {
      dispatch({ type: "OPPONENT_JOINED" })
    }
  }, [
    modeExplicit,
    room.state.roomId,
    room.state.color,
    room.state.status,
    phase.phase,
    dispatch,
  ])

  useSocketEvent(GAME_STARTED, () => {
    dispatch({ type: "OPPONENT_JOINED" })
  })

  useSocketEvent(ROOM_JOINED, (msg) => {
    // Room creation confirmed by server (createRoom flow)
    if (pendingCreateRef?.current) {
      pendingCreateRef.current = false
      dispatch({ type: "ROOM_CREATED", roomId: msg.roomId })
      return
    }
    // Stale invite: server created a different room than the link points to
    if (phase.phase === "joining" && msg.roomId !== phase.roomId) {
      gooeyToast.error("Room not found", {
        description: "The invite link may be expired.",
      })
      dispatch({ type: "JOIN_FAILED", mode: "friend" })
      return
    }
    // Successful join from invite link
    if (phase.phase === "joining") {
      dispatch({ type: "OPPONENT_JOINED" })
      return
    }
    // Opponent joined while we were waiting (invite / search phase)
    if (hasGameStarted(msg.state.status)) {
      dispatch({ type: "OPPONENT_JOINED" })
    }
  })
}
