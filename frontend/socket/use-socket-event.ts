"use client"

import { useEffect, useRef } from "react"

import { useSocketContext } from "./socket-provider"
import { hasType, type Incoming } from "./incoming"

/**
 * Subscribes to one incoming message type for the life of the component.
 * Narrows `handler`'s argument to the exact shape for `type` — no manual
 * type guard needed.
 *
 *   useSocketEvent(MOVE_MADE, (msg) => { ... })
 *
 * `handler` is read through a ref, so it doesn't need to be memoized —
 * passing a fresh closure each render is fine. Only `type` changing
 * re-subscribes.
 */
export function useSocketEvent<K extends Incoming["type"]>(
  type: K,
  handler: (message: Extract<Incoming, { type: K }>) => void
): void {
  const { onMessage } = useSocketContext()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    return onMessage((raw) => {
      if (hasType(raw, type)) {
        handlerRef.current(raw)
      }
    })
  }, [onMessage, type])
}
