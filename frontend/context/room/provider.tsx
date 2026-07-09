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
  ROOM_LEFT,
  GRACE_STARTED,
  GRACE_CANCELLED,
  GRACE_EXPIRED,
  CLOCK_EXPIRED,
} from "@/socket/events"
import { WHITE } from "@/core/piece"
import { useSocketContext } from "@/socket/context"

const TOAST_ID_CONN = "connection-status"

const initialState: RoomState = {
  roomId: null,
  color: null,
  status: null,
  result: null,
  pendingUndo: null,
}

const CONNECTED_DISMISS_MS = 2_000

function useConnectionToast() {
  const { status, reconnect } = useSocketContext()
  const toastAlive = useRef(false)
  const hasEverOpened = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearDismissTimer = () => {
      if (!dismissTimer.current) return
      clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }

    // Title-only toast, no description/action carried over from a
    // previous state (e.g. a lingering "failed" description/retry).
    const show = (
      type: "info" | "warning" | "success" | "error",
      title: string,
      extra?: {
        description?: string
        action?: { label: string; onClick: () => void }
      },
    ) => {
      const opts = { description: undefined, action: undefined, ...extra }

      if (toastAlive.current) {
        gooeyToast[type](title, {
          id: TOAST_ID_CONN,
          duration: Infinity,
          showProgress: false,
          onDismiss: () => {
            toastAlive.current = false
          },
          ...opts,
        })
        return
      }

      gooeyToast[type](title, {
        id: TOAST_ID_CONN,
        duration: Infinity,
        showProgress: false,
        onDismiss: () => {
          toastAlive.current = false
        },
        ...opts,
      })
      toastAlive.current = true
    }

    clearDismissTimer()

    switch (status) {
      case "connecting":
        show("info", hasEverOpened.current ? "Reconnecting" : "Connecting")
        break

      case "reconnecting":
        show("warning", "Reconnecting")
        break

      case "failed":
        // Description + retry action stay put — the toast is only ever
        // removed by the user (Retry, close/swipe/escape, or manual dismiss).
        show("error", "Connection failed", {
          description: "Unable to connect. Please refresh or try again.",
          action: { label: "Retry", onClick: () => reconnect() },
        })
        break

      case "open":
        hasEverOpened.current = true
        show("success", "Connected")
        dismissTimer.current = setTimeout(() => {
          gooeyToast.dismiss(TOAST_ID_CONN)
          toastAlive.current = false
          dismissTimer.current = null
        }, CONNECTED_DISMISS_MS)
        break

      case "closed":
        gooeyToast.dismiss(TOAST_ID_CONN)
        toastAlive.current = false
        break
    }

    return clearDismissTimer
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

  useSocketEvent(UNDO_DECLINED, () => {
    dispatch({ type: "UNDO_RESOLVED" })
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
