import { describe, expect, test } from "bun:test"
import { gameReducer, type GameState } from "./use-game"
import { Board } from "@/lib/core/board"
import { WHITE, BLACK } from "@/lib/core/piece"
import { Position } from "@/lib/core/position"
import {
  IN_PROGRESS,
  CHECKMATE,
  RULES,
  NO_DRAW_REASON,
  type GameOutcome,
} from "@/socket/incoming"

const outcome = (overrides: Partial<GameOutcome> = {}): GameOutcome => ({
  status: IN_PROGRESS,
  winner: WHITE,
  hasWinner: false,
  drawReason: NO_DRAW_REASON,
  reason: RULES,
  ...overrides,
})

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    board: Board.create(),
    roomId: null,
    color: null,
    started: false,
    isCheck: false,
    result: null,
    clock: null,
    pendingUndo: null,
    turn: null,
    lastMoveRejection: null,
    ...overrides,
  }
}

describe("gameReducer", () => {
  test("ROOM_JOINED sets roomId, color, board, check/result/turn and clears rejection", () => {
    const state = makeState({
      lastMoveRejection: {
        reason: "illegal-move",
        from: Position(0),
        to: Position(1),
      },
    })
    const board = Board.create()
    const result = outcome()

    const next = gameReducer(state, {
      type: "ROOM_JOINED",
      roomId: "room-1",
      color: WHITE,
      board,
      isCheck: true,
      result,
      turn: BLACK,
      started: false,
    })

    expect(next.roomId).toBe("room-1")
    expect(next.color).toBe(WHITE)
    expect(next.board).toBe(board)
    expect(next.isCheck).toBe(true)
    expect(next.result).toBe(result)
    expect(next.turn).toBe(BLACK)
    expect(next.lastMoveRejection).toBeNull()
    expect(next.started).toBe(false)
  })

  test("ROOM_JOINED sets started true when the snapshot's room status is already ACTIVE/FINISHED (reload into a live game)", () => {
    const state = makeState()
    const board = Board.create()

    const next = gameReducer(state, {
      type: "ROOM_JOINED",
      roomId: "room-1",
      color: WHITE,
      board,
      isCheck: false,
      result: outcome(),
      turn: WHITE,
      started: true,
    })

    expect(next.started).toBe(true)
  })

  test("GAME_STARTED replaces board/clock/turn, and flips started to true", () => {
    const state = makeState({ isCheck: true, roomId: "room-1" })
    const board = Board.create()

    const next = gameReducer(state, {
      type: "GAME_STARTED",
      board,
      clock: { whiteMs: 1000, blackMs: 1000, active: WHITE },
      turn: WHITE,
    })

    expect(next.board).toBe(board)
    expect(next.clock).toEqual({ whiteMs: 1000, blackMs: 1000, active: WHITE })
    expect(next.turn).toBe(WHITE)
    expect(next.started).toBe(true)
    // Unrelated fields untouched.
    expect(next.isCheck).toBe(true)
    expect(next.roomId).toBe("room-1")
  })

  test("GAME_STARTED flips started to true even when clock is null", () => {
    // Clocks aren't implemented server-side yet, so GAME_STARTED always
    // carries clock: null today. `started` must not depend on it.
    const state = makeState({ roomId: "room-1" })
    const board = Board.create()

    const next = gameReducer(state, {
      type: "GAME_STARTED",
      board,
      clock: null,
      turn: WHITE,
    })

    expect(next.clock).toBeNull()
    expect(next.started).toBe(true)
  })

  test("MOVE_RESULT updates check/result/clock/turn and clears rejection", () => {
    const state = makeState({
      lastMoveRejection: {
        reason: "illegal-move",
        from: Position(0),
        to: Position(1),
      },
    })
    const result = outcome({ status: CHECKMATE })

    const next = gameReducer(state, {
      type: "MOVE_RESULT",
      isCheck: true,
      result,
      clock: null,
      turn: BLACK,
    })

    expect(next.isCheck).toBe(true)
    expect(next.result).toBe(result)
    expect(next.clock).toBeNull()
    expect(next.turn).toBe(BLACK)
    expect(next.lastMoveRejection).toBeNull()
  })

  test("UNDO_APPLIED replaces board/check/result/turn and clears pendingUndo", () => {
    const state = makeState({
      pendingUndo: { by: WHITE, expiresAt: 1234 },
    })
    const board = Board.create()
    const result = outcome()

    const next = gameReducer(state, {
      type: "UNDO_APPLIED",
      board,
      isCheck: false,
      result,
      turn: WHITE,
    })

    expect(next.board).toBe(board)
    expect(next.isCheck).toBe(false)
    expect(next.result).toBe(result)
    expect(next.turn).toBe(WHITE)
    expect(next.pendingUndo).toBeNull()
  })

  test("GAME_ENDED sets result and clears pendingUndo", () => {
    const state = makeState({ pendingUndo: { by: BLACK, expiresAt: 999 } })
    const result = outcome({ status: CHECKMATE, hasWinner: true })

    const next = gameReducer(state, { type: "GAME_ENDED", result })

    expect(next.result).toBe(result)
    expect(next.pendingUndo).toBeNull()
  })

  test("UNDO_REQUESTED sets pendingUndo", () => {
    const state = makeState()

    const next = gameReducer(state, {
      type: "UNDO_REQUESTED",
      by: BLACK,
      expiresAt: 5000,
    })

    expect(next.pendingUndo).toEqual({ by: BLACK, expiresAt: 5000 })
  })

  test("UNDO_RESOLVED clears pendingUndo", () => {
    const state = makeState({ pendingUndo: { by: WHITE, expiresAt: 1 } })

    const next = gameReducer(state, { type: "UNDO_RESOLVED" })

    expect(next.pendingUndo).toBeNull()
  })

  test("MOVE_REJECTED records reason/from/to", () => {
    const state = makeState()

    const next = gameReducer(state, {
      type: "MOVE_REJECTED",
      reason: "not-your-turn",
      from: Position(10),
      to: Position(20),
    })

    expect(next.lastMoveRejection).toEqual({
      reason: "not-your-turn",
      from: Position(10),
      to: Position(20),
    })
  })

  test("ROOM_LEFT clears roomId, color, started and pendingUndo", () => {
    const state = makeState({
      roomId: "room-1",
      color: WHITE,
      started: true,
      pendingUndo: { by: WHITE, expiresAt: 1 },
    })

    const next = gameReducer(state, { type: "ROOM_LEFT" })

    expect(next.roomId).toBeNull()
    expect(next.color).toBeNull()
    expect(next.started).toBe(false)
    expect(next.pendingUndo).toBeNull()
  })

  test("actions not covered above leave board reference unchanged", () => {
    const state = makeState()
    const next = gameReducer(state, { type: "UNDO_RESOLVED" })
    expect(next.board).toBe(state.board)
  })
})
