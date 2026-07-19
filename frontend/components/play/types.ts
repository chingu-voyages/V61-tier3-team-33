import type { FC } from "react"
import type { PieceColor } from "@/chess/core/piece"

export interface TimeControl {
  id: string
  name: string
  description: string
  initialMs: number
  incrementMs: number
  icon: FC<{ className?: string }>
  accent: string
}

export type PlayMode = "friend" | "online"

export type Phase =
  | { phase: "pick-time"; mode: PlayMode }
  | { phase: "creating"; timeControl: TimeControl; color?: PieceColor }
  | { phase: "joining"; roomId: string }
  | { phase: "invite"; roomId: string; timeControl: TimeControl; color?: PieceColor }
  | { phase: "search"; timeControl: TimeControl }
  | { phase: "play" }

export type ColorChoice = PieceColor | null
