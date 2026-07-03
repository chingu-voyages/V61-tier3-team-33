import { describe, expect, test } from "bun:test"
import { derivePlayPhase } from "./use-play-phase"
import type { SessionState } from "../../context/session-reducer"
import type { GameState } from "../../context/use-game"
import { Board } from "@/lib/core/board"
import { WHITE } from "@/lib/core/piece"
import {
  IN_PROGRESS,
  CHECKMATE,
  RULES,
  NO_DRAW_REASON,
} from "@/socket/incoming"

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    status: "idle",
    playerId: null,
    token: null,
    error: null,
    ...overrides,
  }
}

function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    board: Board.create(),
    roomId: null,
    color: null,
    started: false,
    isCheck: false,
    result: null,
    clock: null,
    pendingUndo: null,
    lastMoveRejection: null,
    ...overrides,
  } as GameState
}

describe("derivePlayPhase", () => {
  test("not authenticated -> connecting, regardless of game state", () => {
    const session = makeSession({ status: "authenticating" })
    expect(derivePlayPhase(session, makeGame())).toBe("connecting")
    expect(
      derivePlayPhase(session, makeGame({ roomId: "r1", color: WHITE }))
    ).toBe("connecting")
  })

  test("authenticated, no room -> dashboard", () => {
    const session = makeSession({ status: "authenticated" })
    expect(derivePlayPhase(session, makeGame())).toBe("dashboard")
  })

  test("room joined, not started -> waiting", () => {
    const session = makeSession({ status: "authenticated" })
    const game = makeGame({
      roomId: "r1",
      color: WHITE,
      started: false,
      result: {
        status: IN_PROGRESS,
        winner: WHITE,
        hasWinner: false,
        drawReason: NO_DRAW_REASON,
        reason: RULES,
      },
    })
    expect(derivePlayPhase(session, game)).toBe("waiting")
  })

  test("room joined, not started, even with a clock somehow present -> waiting", () => {
    // Guards against re-coupling phase detection to `clock`: clocks
    // aren't implemented server-side yet, but even if one showed up,
    // `started` — not `clock` — is what should gate this transition.
    const session = makeSession({ status: "authenticated" })
    const game = makeGame({
      roomId: "r1",
      color: WHITE,
      started: false,
      clock: { whiteMs: 1000, blackMs: 1000, active: WHITE },
    })
    expect(derivePlayPhase(session, game)).toBe("waiting")
  })

  test("started -> game", () => {
    const session = makeSession({ status: "authenticated" })
    const game = makeGame({
      roomId: "r1",
      color: WHITE,
      started: true,
    })
    expect(derivePlayPhase(session, game)).toBe("game")
  })

  test("started, with clock still null -> game", () => {
    // The real-world case today: game:started fires with clock: null
    // (clocks not implemented yet), and the UI should still advance.
    const session = makeSession({ status: "authenticated" })
    const game = makeGame({
      roomId: "r1",
      color: WHITE,
      started: true,
      clock: null,
    })
    expect(derivePlayPhase(session, game)).toBe("game")
  })

  test("game concluded (checkmate) -> game, since started was already true", () => {
    const session = makeSession({ status: "authenticated" })
    const game = makeGame({
      roomId: "r1",
      color: WHITE,
      started: true,
      clock: null,
      result: {
        status: CHECKMATE,
        winner: WHITE,
        hasWinner: true,
        drawReason: NO_DRAW_REASON,
        reason: RULES,
      },
    })
    expect(derivePlayPhase(session, game)).toBe("game")
  })
})
