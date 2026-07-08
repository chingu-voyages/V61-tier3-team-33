"use client"

import { useSearchParams } from "next/navigation"
import { PlayScreen } from "./PlayScreen"
import type { PlayMode } from "./types"

export function PlayPage() {
  const params = useSearchParams()
  return (
    <PlayScreen
      mode={(params.get("mode") as PlayMode) ?? "online"}
      roomId={params.get("room") ?? undefined}
    />
  )
}
