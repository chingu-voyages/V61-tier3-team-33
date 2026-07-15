import { describe, expect, it } from "bun:test"
import { roomReducer, type RoomState } from "./reducer"
import { ACTIVE, FINISHED, WAITING } from "@/socket/types"
import { WHITE, BLACK } from "@/core/piece"
import { GameStatus, DrawReason } from "@/core/game"
import type { GameSnapshot } from "@/socket/types"

const baseSnapshot: GameSnapshot = {
  status: ACTIVE,
  fen: "startpos",
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

function joined(roomId: string, color = WHITE): RoomState {
  return roomReducer(
    {
      roomId: null,
      color: null,
      status: null,
      result: null,
      pendingUndo: null,
      initialized: false,
    },
    { type: "ROOM_JOINED", roomId, color, status: WAITING, state: baseSnapshot }
  )
}

describe("roomReducer — stale event guarding", () => {
  it("ROOM_JOINED always applies and adopts the new room", () => {
    const state = joined("room-new", BLACK)
    expect(state.roomId).toBe("room-new")
    expect(state.color).toBe(BLACK)
  })

  it("ignores a GAME_ENDED for a room we've since switched away from", () => {
    // Player was in room-old, then switched to room-new (e.g. clicked "Play Online").
    const afterSwitch = joined("room-new")

    // room-old's game:ended (abandonment) arrives late on the same socket.
    const result = roomReducer(afterSwitch, {
      type: "GAME_ENDED",
      roomId: "room-old",
      result: {
        status: GameStatus(1),
        winner: BLACK,
        hasWinner: true,
        drawReason: DrawReason(0),
        reason: 3,
      },
    })

    // The freshly-joined room must be untouched — no phantom "finished" state.
    expect(result).toEqual(afterSwitch)
  })

  it("ignores a stale ROOM_LEFT for a room we've since switched away from", () => {
    const afterSwitch = joined("room-new")

    const result = roomReducer(afterSwitch, {
      type: "ROOM_LEFT",
      roomId: "room-old",
      color: WHITE,
    })

    expect(result).toEqual(afterSwitch)
  })

  it("still applies GAME_ENDED for the room we're actually in", () => {
    const current = joined("room-new")

    const result = roomReducer(current, {
      type: "GAME_ENDED",
      roomId: "room-new",
      result: {
        status: GameStatus(1),
        winner: WHITE,
        hasWinner: true,
        drawReason: DrawReason(0),
        reason: 2,
      },
    })

    expect(result.status).toBe(FINISHED)
    expect(result.result?.winner).toBe(WHITE)
  })
})
