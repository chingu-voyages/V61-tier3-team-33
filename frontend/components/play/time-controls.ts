import {
  IconBolt,
  IconFlame,
  IconWind,
  IconClock,
  IconHourglass,
  IconCoffee,
} from "@tabler/icons-react"
import type { TimeControl } from "./types"

// ids must match the backend's ClockFormat values (see
// backend/src/server/clock/move/*.ts) — GameService sends `tc.id` straight
// through as the clock format, and Games queues/searches games keyed on
// that exact string, so a mismatched id here means matchmaking silently
// creates a room nobody can ever find.
export const DEFAULT_TIME_CONTROLS: TimeControl[] = [
  {
    id: "bullet",
    name: "Bullet",
    description: "30s per move",
    initialMs: 30_000,
    incrementMs: 0,
    icon: IconBolt,
    accent: "text-red-500",
  },
  {
    id: "blitz",
    name: "Blitz",
    description: "1 min per move",
    initialMs: 60_000,
    incrementMs: 0,
    icon: IconFlame,
    accent: "text-orange-500",
  },
  {
    id: "swift",
    name: "Swift",
    description: "2 min per move",
    initialMs: 120_000,
    incrementMs: 0,
    icon: IconWind,
    accent: "text-amber-500",
  },
  {
    id: "steady",
    name: "Steady",
    description: "3 min per move",
    initialMs: 180_000,
    incrementMs: 0,
    icon: IconClock,
    accent: "text-green-500",
  },
  {
    id: "patient",
    name: "Patient",
    description: "5 min per move",
    initialMs: 300_000,
    incrementMs: 0,
    icon: IconHourglass,
    accent: "text-teal-500",
  },
  {
    id: "casual",
    name: "Casual",
    description: "10 min per move",
    initialMs: 600_000,
    incrementMs: 0,
    icon: IconCoffee,
    accent: "text-blue-500",
  },
]
