import type { TimeControl } from "./types"

export function formatTimeControlLabel(tc: TimeControl): string {
  return `${tc.initialMs / 60000}min${
    tc.incrementMs ? ` + ${tc.incrementMs / 1000}s` : ""
  }`
}
