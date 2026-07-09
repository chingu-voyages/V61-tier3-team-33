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
  const isActive = live?.active === color

  const isWarning = ms !== undefined && ms <= 10_000 && ms > 5_000
  const isCritical = ms !== undefined && ms <= 5_000 && ms > 0

  return (
    <div
      className={[
        "flex w-full items-center justify-between rounded-lg px-3 py-2 transition-all duration-300",
        isActive
          ? "bg-primary/10 ring-1 ring-primary/40 shadow-[0_0_12px_2px_hsl(var(--primary)/0.15)]"
          : "bg-muted/30",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {getPieceIcon({ type: KNIGHT, color }, { className: "size-5" })}
        <span className={["font-medium text-sm", isActive ? "text-foreground" : "text-muted-foreground"].join(" ")}>
          {label}
        </span>
        {isActive && (
          <span className="size-2 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      <span
        className={[
          "tabular-nums font-mono font-semibold text-base transition-colors duration-300",
          isCritical
            ? "text-red-500 animate-pulse"
            : isWarning
            ? "text-orange-400"
            : isActive
            ? "text-foreground"
            : "text-muted-foreground",
        ].join(" ")}
      >
        {fmtClock(ms)}
      </span>
    </div>
  )
}
