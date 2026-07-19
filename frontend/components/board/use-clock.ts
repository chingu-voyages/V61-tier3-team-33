"use client"

import { useEffect, useState } from "react"
import type { ClockState } from "@/socket/types"
import { WHITE, BLACK } from "@/core/piece"

export function useClock(
  clock: ClockState | null,
  receivedAt: number | null
): ClockState | null {
  const [now, setNow] = useState<number>(0)

  useEffect(() => {
    if (!clock || receivedAt === null || clock.active === null) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [clock, receivedAt])

  if (!clock || receivedAt === null || clock.active === null) return clock

  const elapsed = now > 0 ? now - receivedAt : 0
  return {
    whiteMs: Math.max(
      0,
      clock.whiteMs - (clock.active === WHITE ? elapsed : 0)
    ),
    blackMs: Math.max(
      0,
      clock.blackMs - (clock.active === BLACK ? elapsed : 0)
    ),
    active: clock.active,
  }
}
