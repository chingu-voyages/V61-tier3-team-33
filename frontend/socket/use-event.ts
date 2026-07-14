"use client"

import { useEffect, useRef } from "react"
import { useSocketContext } from "./context"
import { hasType, ANY, type ServerEvent } from "./events"

export function useSocketEvent(
  type: typeof ANY,
  handler: (message: ServerEvent) => void
): void

export function useSocketEvent<K extends ServerEvent["type"]>(
  type: K,
  handler: (message: Extract<ServerEvent, { type: K }>) => void
): void

export function useSocketEvent(
  type: ServerEvent["type"] | typeof ANY,
  handler: (message: ServerEvent) => void
): void {
  const { onMessage, onAnyMessage } = useSocketContext()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (type === ANY) {
      return onAnyMessage((raw) => handlerRef.current(raw as ServerEvent))
    }
    return onMessage(type, (raw) => {
      if (hasType(raw, type)) handlerRef.current(raw)
    })
  }, [onMessage, onAnyMessage, type])
}
