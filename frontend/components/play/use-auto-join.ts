import { useEffect, useRef } from "react"
import type { Phase } from "./types"
import type { GameActions } from "@/socket/use-action"
import type { Action } from "./play-reducer"
import { HUMAN_VS_HUMAN } from "@/socket/types"
import type { SessionInfo } from "@/context/session/session-context"
import { useSocketEvent } from "@/socket/use-event"
import { SESSION_ERROR } from "@/socket/errors"
import { gooeyToast } from "@/components/ui/goey-toaster"

/**
 * Auto-join via invite link. Fires once per roomId/session lifecycle,
 * and handles SESSION_ERROR during joining to allow re-try.
 *
 * The Effect depends on `roomId` (via a conditional key) so it resets
 * `joinSentRef` when targeting a new room, and only sends the join when
 * session is ready — re-joining after reconnect without re-rendering.
 */
export function useAutoJoin(
  phase: Phase,
  session: SessionInfo | null,
  actions: GameActions,
  dispatch: React.Dispatch<Action>
) {
  const joinSentRef = useRef(false)
  const roomId = phase.phase === "joining" ? phase.roomId : undefined

  // Reset the guard whenever we target a *new* roomId.
  useEffect(() => {
    if (!roomId) return
    joinSentRef.current = false
  }, [roomId])

  // Send join once session is ready.
  useEffect(() => {
    if (session && roomId && !joinSentRef.current) {
      joinSentRef.current = true
      actions.joinRoom({ mode: HUMAN_VS_HUMAN, roomId })
    }
  }, [session, roomId, actions])

  // Re-enable join if the server rejects the current attempt.
  useSocketEvent(SESSION_ERROR, (msg) => {
    if (phase.phase === "creating") {
      gooeyToast.error("Couldn't create room", { description: msg.message })
      dispatch({ type: "CREATE_FAILED" })
      return
    }

    if (phase.phase !== "joining") return
    joinSentRef.current = false
    gooeyToast.error("Couldn't join game", { description: msg.message })
    dispatch({ type: "JOIN_FAILED", mode: "friend" })
  })
}
