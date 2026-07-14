"use client"

import { useReducer, useMemo } from "react"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { roomReducer, type RoomState } from "./reducer"
import { RoomContext } from "./context"
import { useSocketEvent } from "@/socket/use-event"
import { useSocketStatus } from "@/socket/use-status"
import { CONNECTING, OPEN, RECONNECTING, FAILED, CLOSED } from "@/socket/reducer"
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
import { SESSION_ERROR, ROOM_RESET_CODES, UNDO_ERROR_MESSAGES, ERROR_MESSAGES } from "@/socket/errors"
import { SESSION_HANDSHAKE } from "@/socket/commands"

const initialState: RoomState = {
  roomId: null,
  color: null,
  status: null,
  result: null,
  pendingUndo: null,
  initialized: false,
}

const CONNECTED_DISMISS_MS = 2_000

function toastId(status: string): string {
  return `connection-${status}`
}

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(roomReducer, initialState)
  const actions = useGameActions()
  const { reconnect } = useSocketContext()

  useSocketStatus(OPEN, (prev) => {
    if (prev) gooeyToast.dismiss(toastId(prev))
    gooeyToast.dismiss(toastId(FAILED))
    gooeyToast.success("Connected", {
      id: toastId(OPEN),
      timing: { displayDuration: CONNECTED_DISMISS_MS },
    })
  })

  useSocketStatus(CONNECTING, (prev) => {
    if (prev !== FAILED) {
      gooeyToast.info("Connecting", {
        id: toastId(CONNECTING),
        timing: { displayDuration: 3_600_000 },
      })
    }
  })

  useSocketStatus(RECONNECTING, (prev) => {
    if (prev) gooeyToast.dismiss(toastId(prev))
    gooeyToast.warning("Reconnecting", {
      id: toastId(RECONNECTING),
      timing: { displayDuration: 3_600_000 },
    })
  })

  useSocketStatus(FAILED, (prev) => {
    if (prev) gooeyToast.dismiss(toastId(prev))
    gooeyToast.error("Connection failed", {
      id: toastId(FAILED),
      timing: { displayDuration: 3_600_000 },
      description: "Unable to connect. Please refresh or try again.",
      action: { label: "Retry", onClick: () => { gooeyToast.dismiss(toastId(FAILED)); reconnect() } },
    })
  })

  useSocketStatus(CLOSED, (prev) => {
    if (prev) gooeyToast.dismiss(toastId(prev))
  })

  useSocketEvent(SESSION_HANDSHAKE, (msg) => {
    dispatch({ type: "HANDSHAKE", roomId: msg.roomId })
  })

  useSocketEvent(GAME_STARTED, (msg) => {
    dispatch({ type: "GAME_STARTED", roomId: msg.roomId })
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    if (msg.isGameOver && msg.result) {
      dispatch({ type: "GAME_ENDED", roomId: msg.roomId, result: msg.result })
    }
  })

  useSocketEvent(UNDO_REQUESTED, (msg) => {
    dispatch({ type: "UNDO_REQUESTED", roomId: msg.roomId, by: msg.by, expiresAt: msg.expiresAt })
  })

  useSocketEvent(UNDO_DECLINED, (msg) => {
    if (msg.by !== state.color) {
      gooeyToast.info("You declined the undo request")
    } else {
      gooeyToast.info("Opponent declined the undo request")
    }
    dispatch({ type: "UNDO_RESOLVED", roomId: msg.roomId })
  })

  useSocketEvent(UNDO_CANCELLED, (msg) => {
    dispatch({ type: "UNDO_CANCELLED", roomId: msg.roomId })
  })

  useSocketEvent(UNDO_EXPIRED, (msg) => {
    gooeyToast.info("Undo request expired")
    dispatch({ type: "UNDO_EXPIRED", roomId: msg.roomId })
  })

  useSocketEvent(UNDO_INVALIDATED, (msg) => {
    dispatch({ type: "UNDO_INVALIDATED", roomId: msg.roomId })
  })

  useSocketEvent(UNDO_APPLIED, (msg) => {
    dispatch({ type: "UNDO_APPLIED", roomId: msg.roomId, status: msg.state.status })
  })

  useSocketEvent(GAME_ENDED, (msg) => {
    dispatch({ type: "GAME_ENDED", roomId: msg.roomId, result: msg.result })
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
    // stale room:left from a room we've since switched away from — ignore
    if (msg.roomId !== state.roomId) return
    if (msg.color !== state.color) {
      const who = msg.color === WHITE ? "White" : "Black"
      gooeyToast.info(`${who} left the game`)
    }
    dispatch({ type: "ROOM_LEFT", roomId: msg.roomId, color: msg.color })
  })

  useSocketEvent(SESSION_ERROR, (msg) => {
    if (ROOM_RESET_CODES.has(msg.code)) {
      dispatch({ type: "ROOM_RESET" })
      return
    }

    const undoDescription = UNDO_ERROR_MESSAGES[msg.code]
    if (undoDescription) {
      gooeyToast.error(undoDescription)
      return
    }

    const description = ERROR_MESSAGES[msg.code]
    if (description) {
      gooeyToast.error(description)
    }
  })

  useSocketEvent(GRACE_STARTED, (msg) => {
    const who = msg.color === WHITE ? "White" : "Black"
    gooeyToast.warning(`${who} disconnected`, {
      description: "Waiting for reconnection...",
      duration: 10_000,
    })
  })

  useSocketEvent(GRACE_CANCELLED, (msg) => {
    const who = msg.color === WHITE ? "White" : "Black"
    gooeyToast.success(`${who} reconnected`)
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
