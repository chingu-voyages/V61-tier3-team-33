"use client"

import { useClock } from "@/components/board/use-clock"
import type { PieceColor } from "@/core/piece"
import type { ClockState } from "@/socket/types"
import { WHITE, KNIGHT } from "@/core/piece"
import { getPieceIcon } from "@/components/pieces"
import { cn } from "@/lib/utils"
import { formatClock } from "./helpers"

interface ClockDisplayProps {
  color: PieceColor
  label: string
  clock: ClockState | null
  clockReceivedAt: number | null
}

export function ClockDisplay({
  color,
  label,
  clock,
  clockReceivedAt,
}: ClockDisplayProps) {
  const live = useClock(clock, clockReceivedAt)
  const ms = color === WHITE ? live?.whiteMs : live?.blackMs
  const isActive = live?.active === color

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1 text-sm text-muted-foreground transition-all duration-300",
        isActive &&
          "bg-chess-selected-fill/15 ring-1 ring-chess-selected-border-on-light dark:ring-chess-selected-border-on-dark"
      )}
    >
      <div className="flex items-center gap-2">
        {isActive && (
          <span className="inline-block size-2 animate-pulse rounded-full bg-chess-check-fill" />
        )}
        {getPieceIcon({ type: KNIGHT, color }, { className: "size-5" })}
        <span
          className={[
            "text-sm font-medium",
            isActive ? "text-foreground" : "text-muted-foreground",
          ].join(" ")}
        >
          {label}
        </span>
        {isActive && (
          <span className="size-2 animate-pulse rounded-full bg-primary" />
        )}
      </div>
      <span className="tabular-nums">{formatClock(ms)}</span>
    </div>
  )
}
