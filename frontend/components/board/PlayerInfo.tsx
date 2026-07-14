import type { PieceColor } from "@/core/piece"
import { WHITE, KNIGHT } from "@/core/piece"
import type { ClockState } from "@/socket/types"
import { getPieceIcon } from "@/components/pieces"
import { formatClock } from "./helpers"

interface PlayerInfoProps {
  color: PieceColor
  label: string
  clock: ClockState | null
}

export function PlayerInfo({ color, label, clock }: PlayerInfoProps) {
  const ms = color === WHITE ? clock?.whiteMs : clock?.blackMs

  return (
    <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        {getPieceIcon({ type: KNIGHT, color }, { className: "size-5" })}
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <span className="tabular-nums">{formatClock(ms)}</span>
    </div>
  )
}
