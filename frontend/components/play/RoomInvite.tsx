"use client"

import { useState } from "react"
import {
  IconLink,
  IconCopy,
  IconShare,
  IconCheck,
  IconUsers,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import type { TimeControl } from "./types"
import { KnightPulse } from "./KnightPulse"

function formatClock(ms: number): string {
  return ms >= 60000 ? `${ms / 60000}` : `${ms / 1000}`
}

interface RoomInviteProps {
  roomId: string
  timeControl: TimeControl
  onCancel: () => void
}

export function RoomInvite({ roomId, timeControl, onCancel }: RoomInviteProps) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/play?mode=friend&room=${roomId}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const shareLink = async () => {
    if (!("share" in navigator)) return
    try {
      await navigator.share({
        title: "Chess Challenge",
        text: "Join my chess game!",
        url,
      })
    } catch {}
  }

  const tcLabel = `${timeControl.initialMs / 60000}min${
    timeControl.incrementMs ? ` + ${timeControl.incrementMs / 1000}s` : ""
  }`

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <KnightPulse />

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconUsers className="size-4" />
          <span>Waiting for opponent</span>
        </div>
        <p className="text-xs text-muted-foreground/60">
          {timeControl.name} &middot; {tcLabel}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border/50 bg-muted/30 p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Share this link
        </div>
        <div className="flex w-full items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm font-mono">
          <IconLink className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{url}</span>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" onClick={copyLink}>
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          {"share" in navigator && (
            <Button variant="outline" className="flex-1" onClick={shareLink}>
              <IconShare className="size-4" />
              Share
            </Button>
          )}
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
