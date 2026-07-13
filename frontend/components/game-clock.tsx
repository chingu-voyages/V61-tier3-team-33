"use client"

import { useEffect } from "react"
import { useGameClock } from "@/hooks/game-clock-use"

interface Props {
  initialMs: number | null
  isRunning: boolean
  showMs?: boolean
  onExpire?: () => void
}

export function GameClock({
  initialMs,
  isRunning,
  showMs = false,
  onExpire,
}: Props) {
  const timeMs = useGameClock(initialMs, isRunning)

  const expired = timeMs !== null && timeMs <= 0

  useEffect(() => {
    if (expired) onExpire?.()
  }, [expired, onExpire])

  const display = formatTime(timeMs, showMs)

  return (
    <div
      className={`font-mono text-4xl font-bold tabular-nums ${expired ? "text-destructive" : "text-foreground"}`}
    >
      {display}
    </div>
  )
}

function formatTime(ms: number | null, showMs: boolean): string {
  if (ms === null) return "--:--"
  if (ms <= 0) return showMs ? "0:00.000" : "0:00"

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000

  const mm = String(minutes).padStart(1, "0")
  const ss = String(seconds).padStart(2, "0")

  if (showMs) {
    const mmm = String(milliseconds).padStart(3, "0")
    return `${mm}:${ss}.${mmm}`
  }

  return `${mm}:${ss}`
}
