"use client"

import { useEffect, useRef } from "react"
import { useSocketContext } from "./context"
import { hasType, type ServerEvent } from "./events"

export function useSocketEvent<K extends ServerEvent["type"]>(
  type: K,
  handler: (message: Extract<ServerEvent, { type: K }>) => void
): void {
  const { onMessage } = useSocketContext()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    return onMessage(type, (raw) => {
      if (hasType(raw, type)) handlerRef.current(raw)
    })
  }, [onMessage, type])
}
