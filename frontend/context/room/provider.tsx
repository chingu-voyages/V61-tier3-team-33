"use client"

import { useReducer, useMemo, useEffect, useRef } from "react"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { roomReducer, type RoomState } from "./reducer"
import { RoomContext } from "./context"
import { useSocketEvent } from "@/socket/use-event"
import { useGameActions } from "@/socket/use-action"
import {
  ROOM_JOINED,
  GAME_STARTED,
  MOVE_MADE,
  UNDO_APPLIED,
  GAME_ENDED,
  UNDO_REQUESTED,
  UNDO_DECLINED,
  UNDO_CANCELLED,
  UNDO_EXPIRED,
  UNDO_INVALIDATED,
  ROOM_LEFT,
  GRACE_STARTED,
  GRACE_CANCELLED,
  GRACE_EXPIRED,
  CLOCK_EXPIRED,
} from "@/socket/events"
import { WHITE } from "@/core/piece"
import { useSocketContext } from "@/socket/context"
import { SESSION_ERROR } from "@/socket/errors"

const initialState: RoomState = {
  roomId: null,
  color: null,
  status: null,
  result: null,
  pendingUndo: null,
}

const CONNECTED_DISMISS_MS = 2_000

function toastId(status: string): string {
  return `connection-${status}`
}

function useConnectionToast() {
  const { status, reconnect } = useSocketContext()
  const prevStatus = useRef<typeof status | null>(null)
  const hasEverOpened = useRef(false)

  useEffect(() => {
    const id = toastId(status)

    // Track if we're retrying from failed state
    const isRetrying = prevStatus.current === "failed" && status === "connecting"

    // Don't dismiss "failed" toast when transitioning to "connecting" (retry)
    // Keep it visible until connection succeeds ("open") or user manually dismisses
    const shouldDismissPrevToast =
      prevStatus.current &&
      prevStatus.current !== status &&
      !isRetrying

    if (shouldDismissPrevToast) {
      gooeyToast.dismiss(toastId(prevStatus.current!))
    }
    prevStatus.current = status

    switch (status) {
      case "connecting":
        // Don't show "connecting" toast if we're retrying from failed -
        // keep the "failed" toast with retry button visible
        if (!isRetrying) {
          gooeyToast.info(hasEverOpened.current ? "Reconnecting" : "Connecting", {
            id,
            duration: Infinity,
          })
        }
        break

      case "reconnecting":
        gooeyToast.warning("Reconnecting", {
          id,
          duration: Infinity,
        })
        break

      case "failed":
        gooeyToast.error("Connection failed", {
          id,
          duration: Infinity,
          description: "Unable to connect. Please refresh or try again.",
          action: { label: "Retry", onClick: () => reconnect() },
        })
        break

      case "open":
        hasEverOpened.current = true
        // Dismiss the "failed" toast if it's still showing (connection recovered)
        gooeyToast.dismiss(toastId("failed"))
        gooeyToast.success("Connected", {
          id,
          duration: CONNECTED_DISMISS_MS,
        })
        break

      case "closed":
        gooeyToast.dismiss(id)
        break
    }
  }, [status, reconnect])
}

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(roomReducer, initialState)
  const actions = useGameActions()
  useConnectionToast()

  useSocketEvent(GAME_STARTED, () => {
    dispatch({ type: "GAME_STARTED" })
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    if (msg.isGameOver && msg.result) {
      dispatch({ type: "GAME_ENDED", result: msg.result })
    }
  })

  useSocketEvent(UNDO_REQUESTED, (msg) => {
    dispatch({ type: "UNDO_REQUESTED", by: msg.by, expiresAt: msg.expiresAt })
  })

  useSocketEvent(UNDO_DECLINED, (msg) => {
    if (msg.by !== state.color) {
      gooeyToast.info("You declined the undo request")
    } else {
      gooeyToast.info("Opponent declined the undo request")
    }
    dispatch({ type: "UNDO_RESOLVED" })
  })

  useSocketEvent(UNDO_CANCELLED, () => {
    dispatch({ type: "UNDO_CANCELLED" })
  })

  useSocketEvent(UNDO_EXPIRED, () => {
    gooeyToast.info("Undo request expired")
    dispatch({ type: "UNDO_EXPIRED" })
  })

  useSocketEvent(UNDO_INVALIDATED, () => {
    dispatch({ type: "UNDO_INVALIDATED" })
  })

  useSocketEvent(UNDO_APPLIED, (msg) => {
    dispatch({ type: "UNDO_APPLIED", status: msg.state.status })
  })

  useSocketEvent(GAME_ENDED, (msg) => {
    dispatch({ type: "GAME_ENDED", result: msg.result })
  })

  useSocketEvent(ROOM_JOINED, (msg) => {
    dispatch({
      type: "ROOM_JOINED",
      roomId: msg.roomId,
      color: msg.color,
      status: msg.state.status,
      state: msg.state,
    })
  })

  useSocketEvent(ROOM_LEFT, (msg) => {
    if (msg.color !== state.color) {
      const who = msg.color === WHITE ? "White" : "Black"
      gooeyToast.info(`${who} left the game`)
    }
    dispatch({ type: "ROOM_LEFT", color: msg.color })
  })

  // Self-heal: if the server says we're not in a game (e.g. room:leave
  // arrives after the room is already gone, so no room:left event ever
  // comes back), drop any stale room state instead of holding onto a
  // finished game forever.
  useSocketEvent(SESSION_ERROR, (msg) => {
    if (msg.code === "not-in-game" || msg.code === "room-not-found") {
      dispatch({ type: "ROOM_RESET" })
      return
    }

    // Undo-specific rejections that don't warrant the confirm/accept
    // dialogs already in flight — surface them as a toast instead.
    const undoErrorMessages: Partial<Record<typeof msg.code, string>> = {
      "no-history": "There's no move to undo yet",
      "pending-conflict": "There's already a pending undo request",
      "not-allowed": "Undo isn't allowed right now",
      "not-your-turn": "It's not your turn to request an undo",
      "game-not-found": "This game no longer exists",
    }
    const description = undoErrorMessages[msg.code]
    if (description) {
      gooeyToast.error(description)
    }
  })

  useSocketEvent(GRACE_STARTED, (msg) => {
    const you = msg.color === WHITE ? "Black" : "White"
    gooeyToast.warning(`${you} disconnected`, {
      description: "Waiting for reconnection...",
      duration: 10_000,
    })
  })

  useSocketEvent(GRACE_CANCELLED, (msg) => {
    const you = msg.color === WHITE ? "Black" : "White"
    gooeyToast.success(`${you} reconnected`)
  })

  useSocketEvent(GRACE_EXPIRED, () => {
    gooeyToast.info("Game abandoned - opponent did not return")
  })

  useSocketEvent(CLOCK_EXPIRED, (msg) => {
    const color = msg.color === WHITE ? "White" : "Black"
    gooeyToast.error(`${color} ran out of time`)
  })

  const value = useMemo(() => ({ state, actions }), [state, actions])

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}
