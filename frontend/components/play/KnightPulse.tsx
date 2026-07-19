"use client"

import { IconPlayerTrackNext } from "@tabler/icons-react"
import { getPieceIcon } from "@/components/pieces"
import { KNIGHT, WHITE, BLACK } from "@/core/piece"

export function KnightPulse() {
  return (
    <div className="flex items-center gap-4">
      <div className="animate-pulse">
        {getPieceIcon(
          { type: KNIGHT, color: WHITE },
          { className: "size-16 opacity-60" }
        )}
      </div>
      <IconPlayerTrackNext className="size-8 animate-pulse text-muted-foreground" />
      <div className="animate-pulse" style={{ animationDelay: "500ms" }}>
        {getPieceIcon(
          { type: KNIGHT, color: BLACK },
          { className: "size-16 opacity-60" }
        )}
      </div>
    </div>
  )
}
