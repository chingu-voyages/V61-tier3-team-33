"use client"

import { useCallback, useEffect, useReducer } from "react"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { ANY } from "@/socket/events"
import { logReducer, type LogEntry } from "./reducer"

export function useDebugPanel() {
  const { status, send, reconnect, onAnySend } = useSocketContext()
  const [log, dispatch] = useReducer(logReducer, [] as LogEntry[])

  useSocketEvent(ANY, (msg) =>
    dispatch({ type: "LOG", direction: "in", data: msg })
  )

  useEffect(() => {
    return onAnySend((payload) =>
      dispatch({ type: "LOG", direction: "out", data: payload })
    )
  }, [onAnySend])

  const sendPayload = useCallback((payload: object) => send(payload), [send])

  const clear = useCallback(() => dispatch({ type: "CLEAR" }), [])

  return { status, reconnect, log, sendPayload, clear }
}
