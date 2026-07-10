"use client"

import { IconWorld } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import type { TimeControl } from "./types"
import { KnightPulse } from "./KnightPulse"

interface MatchSearchProps {
  timeControl: TimeControl
  onCancel: () => void
}

export function MatchSearch({ timeControl, onCancel }: MatchSearchProps) {
  const tcLabel = `${timeControl.initialMs / 60000}min${
    timeControl.incrementMs ? ` + ${timeControl.incrementMs / 1000}s` : ""
  }`

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <KnightPulse />

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconWorld className="size-4" />
          <span>Searching for opponent</span>
        </div>
        <p className="text-xs text-muted-foreground/60">
          {timeControl.name} &middot; {tcLabel}
        </p>
      </div>

      <div className="flex h-16 w-16 items-center justify-center">
        <div className="size-12 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>

      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
