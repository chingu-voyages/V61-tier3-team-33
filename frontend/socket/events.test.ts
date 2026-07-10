import { describe, expect, test } from "bun:test"
import { hasType, ROOM_JOINED, MOVE_MADE, GAME_ENDED } from "./events"
import { GameStatus, DrawReason } from "@/core/game"

describe("hasType", () => {
  test("returns true when type matches", () => {
    expect(hasType({ type: "room:joined" }, ROOM_JOINED)).toBe(true)
  })

  test("returns false when type differs", () => {
    expect(hasType({ type: "game:ended" }, ROOM_JOINED)).toBe(false)
  })

  test("returns false for null", () => {
    expect(hasType(null, ROOM_JOINED)).toBe(false)
  })

  test("returns false for primitives", () => {
    expect(hasType("hello", ROOM_JOINED)).toBe(false)
    expect(hasType(42, ROOM_JOINED)).toBe(false)
    expect(hasType(undefined, ROOM_JOINED)).toBe(false)
  })

  test("returns false for array", () => {
    expect(hasType([], ROOM_JOINED)).toBe(false)
  })

  test("discriminates move:made with game over", () => {
    const msg = { type: "move:made", isGameOver: true, result: { status: GameStatus(1), winner: 0, hasWinner: true, drawReason: DrawReason(0), reason: 0 } }
    if (hasType(msg, MOVE_MADE)) {
      expect(msg.isGameOver).toBe(true)
      expect(msg.result).toBeDefined()
    }
  })

  test("discriminates game:ended with result", () => {
    const msg = { type: "game:ended", roomId: "r1", result: { status: GameStatus(1), winner: 0, hasWinner: true, drawReason: DrawReason(0), reason: 0 }, winner: 0 }
    if (hasType(msg, GAME_ENDED)) {
      expect(msg.result.status).toBe(GameStatus(1))
    }
  })
})
