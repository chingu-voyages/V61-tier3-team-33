import { describe, expect, test } from "bun:test"
import { gameReducer, type GameState } from "./game-reducer"
import { Board } from "@/core/board"
import { WHITE, BLACK } from "@/core/piece"
import { IN_PROGRESS, NO_DRAW_REASON } from "@/core/game"
import { Position, FILE_A, RANK_2, RANK_3 } from "@/core/position"
import { RULES } from "@/socket/types"

const A2 = Position.create(FILE_A, RANK_2)
const A3 = Position.create(FILE_A, RANK_3)

const baseState: GameState = {
  board: Board.create(),
  roomId: null,
  color: null,
  started: false,
  isCheck: false,
  result: null,
  clock: null,
  pendingUndo: null,
  turn: WHITE,
  lastMoveRejection: null,
}

const outcome = {
  status: IN_PROGRESS,
  winner: WHITE,
  hasWinner: false,
  drawReason: NO_DRAW_REASON,
  reason: RULES,
}

describe("gameReducer", () => {
  test("ROOM_JOINED sets roomId/color/board/turn, clears rejection", () => {
    const board = Board.create()
    const next = gameReducer(
      {
        ...baseState,
        lastMoveRejection: { reason: "illegal-move", from: A2, to: A3 },
      },
      {
        type: "ROOM_JOINED",
        roomId: "r1",
        color: BLACK,
        board,
        isCheck: true,
        result: outcome,
        turn: BLACK,
      }
    )
    expect(next.roomId).toBe("r1")
    expect(next.color).toBe(BLACK)
    expect(next.board).toBe(board)
    expect(next.isCheck).toBe(true)
    expect(next.result).toBe(outcome)
    expect(next.turn).toBe(BLACK)
    expect(next.lastMoveRejection).toBeNull()
  })

  test("GAME_STARTED sets board/clock/turn and started=true", () => {
    const board = Board.create()
    const next = gameReducer(baseState, {
      type: "GAME_STARTED",
      board,
      clock: null,
      turn: WHITE,
    })
    expect(next.started).toBe(true)
    expect(next.board).toBe(board)
  })

  test("MOVE_RESULT updates isCheck/result/clock/turn, clears rejection", () => {
    const next = gameReducer(
      {
        ...baseState,
        lastMoveRejection: { reason: "illegal-move", from: A2, to: A3 },
      },
      {
        type: "MOVE_RESULT",
        isCheck: true,
        result: outcome,
        clock: null,
        turn: BLACK,
      }
    )
    expect(next.isCheck).toBe(true)
    expect(next.result).toBe(outcome)
    expect(next.turn).toBe(BLACK)
    expect(next.lastMoveRejection).toBeNull()
  })

  test("UNDO_APPLIED sets board and clears pendingUndo", () => {
    const board = Board.create()
    const next = gameReducer(
      { ...baseState, pendingUndo: { by: WHITE, expiresAt: 1 } },
      {
        type: "UNDO_APPLIED",
        board,
        isCheck: false,
        result: outcome,
        turn: WHITE,
      }
    )
    expect(next.board).toBe(board)
    expect(next.pendingUndo).toBeNull()
  })

  test("GAME_ENDED sets result and clears pendingUndo", () => {
    const next = gameReducer(
      { ...baseState, pendingUndo: { by: WHITE, expiresAt: 1 } },
      { type: "GAME_ENDED", result: outcome }
    )
    expect(next.result).toBe(outcome)
    expect(next.pendingUndo).toBeNull()
  })

  test("UNDO_REQUESTED sets pendingUndo", () => {
    const next = gameReducer(baseState, {
      type: "UNDO_REQUESTED",
      by: BLACK,
      expiresAt: 123,
    })
    expect(next.pendingUndo).toEqual({ by: BLACK, expiresAt: 123 })
  })

  test("UNDO_RESOLVED clears pendingUndo", () => {
    const next = gameReducer(
      { ...baseState, pendingUndo: { by: WHITE, expiresAt: 1 } },
      { type: "UNDO_RESOLVED" }
    )
    expect(next.pendingUndo).toBeNull()
  })

  test("MOVE_REJECTED sets lastMoveRejection", () => {
    const next = gameReducer(baseState, {
      type: "MOVE_REJECTED",
      reason: "illegal-move",
      from: A2,
      to: A3,
    })
    expect(next.lastMoveRejection).toEqual({
      reason: "illegal-move",
      from: A2,
      to: A3,
    })
  })

  test("ROOM_LEFT resets roomId/color/started/pendingUndo", () => {
    const next = gameReducer(
      {
        ...baseState,
        roomId: "r1",
        color: WHITE,
        started: true,
        pendingUndo: { by: WHITE, expiresAt: 1 },
      },
      { type: "ROOM_LEFT" }
    )
    expect(next.roomId).toBeNull()
    expect(next.color).toBeNull()
    expect(next.started).toBe(false)
    expect(next.pendingUndo).toBeNull()
  })
})
