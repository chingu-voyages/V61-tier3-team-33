"use client"

import type { ComponentType } from "react"
import { IconLoader2 } from "@tabler/icons-react"

import { useGame } from "@/context/use-game"
import { useSession } from "@/context/use-session"
import { derivePlayPhase, type PlayPhase } from "./use-play-phase"
import { PlayDashboard } from "./PlayDashboard"
import { WaitingRoom } from "./WaitingRoom"
import { GameScreen } from "./GameScreen"

function ConnectingIndicator() {
  return <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
}

// Explicit phase -> screen lookup, not a chain of `phase === x && <X />`.
// Adding a phase means adding one entry here, not another conditional to
// re-verify is mutually exclusive with the rest.
const PHASE_SCREENS: Record<PlayPhase, ComponentType> = {
  connecting: ConnectingIndicator,
  dashboard: PlayDashboard,
  waiting: WaitingRoom,
  game: GameScreen,
}

/**
 * The play flow's single entry point. Reads session + game state, derives
 * which screen belongs on top, and renders exactly that — callers (e.g.
 * app/page.tsx) just place <Play /> and don't need to know the phase
 * machine exists.
 */
export function Play() {
  const { state: game } = useGame()
  const { state: session } = useSession()
  const phase = derivePlayPhase(session, game)

  const Screen = PHASE_SCREENS[phase]
  return <Screen />
}
