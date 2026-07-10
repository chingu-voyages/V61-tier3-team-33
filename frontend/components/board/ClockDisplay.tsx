"use client"

import { useClock } from "@/hooks/use-clock"
import type { PieceColor } from "@/core/piece"
import type { ClockState } from "@/socket/types"
import { WHITE } from "@/core/piece"
import { getPieceIcon } from "@/components/pieces"
import { KNIGHT } from "@/core/piece"

function fmtClock(ms: number | undefined): string {
  if (ms === undefined) return "--:--"
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

interface ClockDisplayProps {
  color: PieceColor
  label: string
  clock: ClockState | null
  clockReceivedAt: number | null
}

export function ClockDisplay({ color, label, clock, clockReceivedAt }: ClockDisplayProps) {
  const live = useClock(clock, clockReceivedAt)
  const ms = color === WHITE ? live?.whiteMs : live?.blackMs

  return (
    <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        {getPieceIcon({ type: KNIGHT, color }, { className: "size-5" })}
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <span className="tabular-nums">{fmtClock(ms)}</span>
    </div>
  )
}