"use client"

import { useCallback, useReducer } from "react"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { ANY } from "@/socket/events"
import { logReducer, type LogEntry } from "./reducer"

export function useDebugPanel() {
  const { status, send, reconnect } = useSocketContext()
  const [log, dispatch] = useReducer(logReducer, [] as LogEntry[])

  useSocketEvent(ANY, (msg) =>
    dispatch({ type: "LOG", direction: "in", data: msg })
  )

  const sendPayload = useCallback(
    (payload: object) => {
      send(payload)
      dispatch({ type: "LOG", direction: "out", data: payload })
    },
    [send]
  )

  const clear = useCallback(() => dispatch({ type: "CLEAR" }), [])

  return { status, reconnect, log, sendPayload, clear }
}
