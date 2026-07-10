import { describe, expect, test } from "bun:test"
import { roomReducer, type RoomState } from "./reducer"
import { WHITE, BLACK } from "@/core/piece"
import { WAITING, ACTIVE, FINISHED } from "@/socket/types"
import type { Lifecycle, GameOutcome, GameSnapshot } from "@/socket/types"
import { GameStatus, DrawReason } from "@/core/game"

const baseState: RoomState = {
  roomId: null,
  color: null,
  status: null,
  result: null,
  pendingUndo: null,
}

const mockSnapshot: GameSnapshot = {
  status: WAITING,
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  turn: WHITE,
  isCheck: false,
  resultStatus: GameStatus(0),
  winner: WHITE,
  hasWinner: false,
  drawReason: DrawReason(0),
  endReason: 0,
  history: [],
  capturedByWhite: [],
  capturedByBlack: [],
  clock: null,
}

describe("roomReducer", () => {
  test("ROOM_JOINED sets roomId, color, and status", () => {
    const next = roomReducer(baseState, {
      type: "ROOM_JOINED",
      roomId: "room-1",
      color: WHITE,
      status: WAITING as Lifecycle,
      state: mockSnapshot,
    })
    expect(next.roomId).toBe("room-1")
    expect(next.color).toBe(WHITE)
    expect(next.status).toBe(WAITING)
    expect(next.result).toBeNull()
  })

  test("ROOM_JOINED when FINISHED sets result", () => {
    const finishedSnapshot: GameSnapshot = {
      ...mockSnapshot,
      status: FINISHED,
      resultStatus: GameStatus(1),
      winner: BLACK,
      hasWinner: true,
      drawReason: DrawReason(0),
      endReason: 1,
    }
    const next = roomReducer(baseState, {
      type: "ROOM_JOINED",
      roomId: "room-1",
      color: WHITE,
      status: FINISHED as Lifecycle,
      state: finishedSnapshot,
    })
    expect(next.status).toBe(FINISHED)
    expect(next.result).toEqual({
      status: GameStatus(1),
      winner: BLACK,
      hasWinner: true,
      drawReason: DrawReason(0),
      reason: 1,
    })
  })

  test("GAME_STARTED sets status to ACTIVE", () => {
    const waiting = roomReducer(baseState, {
      type: "ROOM_JOINED",
      roomId: "room-1",
      color: WHITE,
      status: WAITING as Lifecycle,
      state: mockSnapshot,
    })
    const next = roomReducer(waiting, { type: "GAME_STARTED" })
    expect(next.status).toBe(ACTIVE)
  })

  test("GAME_ENDED sets status to FINISHED and stores result", () => {
    const result: GameOutcome = {
      status: GameStatus(1),
      winner: WHITE,
      hasWinner: true,
      drawReason: DrawReason(0),
      reason: 0,
    }
    const next = roomReducer(
      { ...baseState, roomId: "room-1", color: WHITE, status: ACTIVE },
      { type: "GAME_ENDED", result }
    )
    expect(next.status).toBe(FINISHED)
    expect(next.result).toBe(result)
    expect(next.pendingUndo).toBeNull()
  })

  test("GAME_ENDED clears pendingUndo", () => {
    const next = roomReducer(
      {
        ...baseState,
        status: ACTIVE,
        pendingUndo: { by: BLACK, expiresAt: 1000 },
      },
      {
        type: "GAME_ENDED",
        result: { status: GameStatus(1), winner: WHITE, hasWinner: true, drawReason: DrawReason(0), reason: 0 },
      }
    )
    expect(next.pendingUndo).toBeNull()
  })

  test("UNDO_REQUESTED sets pendingUndo", () => {
    const next = roomReducer(baseState, {
      type: "UNDO_REQUESTED",
      by: BLACK,
      expiresAt: 5000,
    })
    expect(next.pendingUndo).toEqual({ by: BLACK, expiresAt: 5000 })
  })

  test("UNDO_RESOLVED clears pendingUndo", () => {
    const next = roomReducer(
      { ...baseState, pendingUndo: { by: BLACK, expiresAt: 5000 } },
      { type: "UNDO_RESOLVED" }
    )
    expect(next.pendingUndo).toBeNull()
  })

  test("UNDO_APPLIED clears pendingUndo and updates status", () => {
    const next = roomReducer(
      { ...baseState, status: ACTIVE, pendingUndo: { by: BLACK, expiresAt: 5000 } },
      { type: "UNDO_APPLIED", status: ACTIVE }
    )
    expect(next.pendingUndo).toBeNull()
    expect(next.status).toBe(ACTIVE)
  })

  test("ROOM_LEFT clears state when same color leaves", () => {
    const next = roomReducer(
      { ...baseState, roomId: "room-1", color: WHITE, status: ACTIVE },
      { type: "ROOM_LEFT", color: WHITE }
    )
    expect(next.roomId).toBeNull()
    expect(next.color).toBeNull()
    expect(next.status).toBeNull()
    expect(next.pendingUndo).toBeNull()
  })

  test("ROOM_LEFT ignores when different color leaves", () => {
    const state: RoomState = {
      roomId: "room-1", color: WHITE, status: ACTIVE, result: null, pendingUndo: null,
    }
    const next = roomReducer(state, { type: "ROOM_LEFT", color: BLACK })
    expect(next.roomId).toBe("room-1")
    expect(next.color).toBe(WHITE)
  })
})
