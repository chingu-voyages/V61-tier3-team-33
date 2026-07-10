import { describe, expect, test } from "bun:test"
import { gameReducer, type GameState } from "./game-reducer"
import { Board } from "@/core/board"
import { WHITE, BLACK } from "@/core/piece"
import { IN_PROGRESS, NO_DRAW_REASON } from "@/core/game"
import { Position, FILE_A, RANK_2, RANK_3 } from "@/core/position"
import { RULES, ACTIVE } from "@/socket/types"

const A2 = Position.create(FILE_A, RANK_2)
const A3 = Position.create(FILE_A, RANK_3)

const baseState: GameState = {
  board: Board.create(),
  roomId: null,
  color: null,
  status: null,
  isCheck: false,
  result: null,
  clock: null,
  clockReceivedAt: null,
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
        status: ACTIVE,
        isCheck: true,
        turn: BLACK,
        clock: null,
        clockReceivedAt: null,
      }
    )
    expect(next.roomId).toBe("r1")
    expect(next.color).toBe(BLACK)
    expect(next.board).toBe(board)
    expect(next.isCheck).toBe(true)
    expect(next.status).toBe(ACTIVE)
    expect(next.turn).toBe(BLACK)
    expect(next.lastMoveRejection).toBeNull()
  })

  test("GAME_STARTED sets board/clock/turn and status=ACTIVE", () => {
    const board = Board.create()
    const next = gameReducer(baseState, {
      type: "GAME_STARTED",
      board,
      clock: null,
      clockReceivedAt: null,
      turn: WHITE,
    })
    expect(next.status).toBe(ACTIVE)
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
        clockReceivedAt: null,
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
        status: ACTIVE,
        isCheck: false,
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

  test("ROOM_LEFT resets roomId/color/status/pendingUndo", () => {
    const next = gameReducer(
      {
        ...baseState,
        roomId: "r1",
        color: WHITE,
        status: ACTIVE,
        pendingUndo: { by: WHITE, expiresAt: 1 },
      },
      { type: "ROOM_LEFT", color: WHITE }
    )
    expect(next.roomId).toBeNull()
    expect(next.color).toBeNull()
    expect(next.status).toBeNull()
    expect(next.pendingUndo).toBeNull()
  })
})
