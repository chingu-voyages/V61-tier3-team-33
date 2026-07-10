import type { FC } from "react"

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
  | { phase: "joining"; roomId: string }
  | { phase: "invite"; roomId: string; timeControl: TimeControl }
  | { phase: "search"; timeControl: TimeControl }
  | { phase: "play" }
