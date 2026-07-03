import type { GameState } from "../../context/use-game"
import type { SessionState } from "../../context/session-reducer"

export type PlayPhase = "connecting" | "dashboard" | "waiting" | "game"

/**
 * Derives which screen the play flow should show. Deliberately a pure
 * function of state that already exists — no new server messages, no
 * extra reducer — so it's trivial to unit test and to reason about.
 *
 *   connecting -> dashboard -> waiting -> game
 *                    ^-----------------------|  (leaveRoom / game ends)
 *
 * "waiting" vs "game" is driven by the explicit `started` flag. It's set
 * two ways: room:joined derives it from the snapshot's room-lifecycle
 * status (WAITING vs ACTIVE/FINISHED) — so a reload that re-joins an
 * already-active room lands on "game" immediately — and game:started
 * also flips it true the moment the opponent fills the second seat
 * during a live session. Deliberately not inferred from `clock` — clocks
 * aren't implemented server-side yet, so `clock` is always null
 * regardless of whether the game has actually started.
 */
export function derivePlayPhase(
  session: SessionState,
  game: GameState
): PlayPhase {
  if (session.status !== "authenticated") return "connecting"
  if (!game.roomId) return "dashboard"
  if (!game.started) return "waiting"
  return "game"
}
