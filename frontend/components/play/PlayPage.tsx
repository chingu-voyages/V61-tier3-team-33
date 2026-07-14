"use client"

import { useSearchParams } from "next/navigation"
import { PlayScreen } from "./PlayScreen"
import type { PlayMode } from "./types"

export function PlayPage() {
  const params = useSearchParams()
  const modeParam = params.get("mode")
  return (
    <PlayScreen
      key={params.get("resume") ?? params.get("room") ?? params.get("mode") ?? "default"}
      mode={(modeParam as PlayMode) ?? "online"}
      modeExplicit={modeParam !== null}
      roomId={params.get("room") ?? undefined}
    />
  )
}
