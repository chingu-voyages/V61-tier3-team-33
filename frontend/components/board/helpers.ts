import { File, Position, Rank } from "@/core/position"

export function formatClock(ms: number | undefined): string {
  if (ms === undefined) return "--:--"
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Screen-space row/col (0,0 = top-left of the rendered grid) for a board
 * position, accounting for board flip. Used to place the floating dragged
 * piece and to hit-test pointer coordinates against squares, without ever
 * touching the DOM.
 */
export function squareCoords(
  position: Position,
  flipped: boolean
): { row: number; col: number } {
  const file = Position.file(position)
  const rank = Position.rank(position)
  if (flipped) {
    return { row: rank, col: 7 - file }
  }
  return { row: 7 - rank, col: file }
}

/** Inverse of squareCoords — board position for a screen-space row/col. */
export function positionFromCoords(
  row: number,
  col: number,
  flipped: boolean
): Position {
  if (flipped) {
    return Position.create(File(7 - col), Rank(row))
  }
  return Position.create(File(col), Rank(7 - row))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
