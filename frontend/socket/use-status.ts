"use client"

import { useEffect, useRef } from "react"
import { useSocketContext } from "./context"
import { type SocketStatus } from "./reducer"

export function useSocketStatus(
  status: SocketStatus,
  handler: (prevStatus: SocketStatus | null) => void
): void {
  const { status: currentStatus, prevStatus } = useSocketContext()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (currentStatus === status) {
      handlerRef.current(prevStatus)
    }
  }, [currentStatus, status, prevStatus])
}
