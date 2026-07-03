"use client"

import * as React from "react"
import { IconCheck, IconCopy, IconDoorExit, IconLoader2 } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { useGame } from "@/context/use-game"
import { WHITE } from "@/lib/core/piece"

/**
 * Shown once room:joined has fired but game:started hasn't — i.e. this
 * client is seated but the opponent isn't yet. See derivePlayPhase for
 * exactly how that's inferred from GameState.
 */
export function WaitingRoom() {
  const { state, actions } = useGame()
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    if (!state.roomId) return
    try {
      await navigator.clipboard.writeText(state.roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable (permissions, insecure context) — the
      // room code is still visible to copy by hand.
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border bg-card p-8 text-center text-card-foreground">
      <IconLoader2 className="size-8 animate-spin text-primary" />

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-base font-medium">
          Waiting for an opponent
        </h1>
        <p className="text-sm text-muted-foreground">
          {state.color === WHITE ? "You're playing as White." : "You're playing as Black."}
        </p>
      </div>

      {state.roomId && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-full border bg-secondary px-4 py-2 font-mono text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          {state.roomId}
          {copied ? (
            <IconCheck className="size-3.5 text-emerald-600" />
          ) : (
            <IconCopy className="size-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      <Button variant="outline" onClick={actions.leaveRoom}>
        <IconDoorExit data-icon="inline-start" />
        Leave
      </Button>
    </div>
  )
}
