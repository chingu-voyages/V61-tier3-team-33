import { describe, expect, test } from "bun:test"
import { hasType } from "./incoming"
import { MOVE_MADE, ROOM_JOINED, SESSION_ERROR } from "./incoming"
import { SESSION_HANDSHAKE } from "./commands"

describe("hasType", () => {
  test("matches when `type` equals the given tag", () => {
    const raw = { type: ROOM_JOINED, roomId: "r1" }
    expect(hasType(raw, ROOM_JOINED)).toBe(true)
  })

  test("rejects a different tag", () => {
    const raw = { type: MOVE_MADE }
    expect(hasType(raw, ROOM_JOINED)).toBe(false)
  })

  test("rejects non-object input", () => {
    expect(hasType("session:handshake", SESSION_HANDSHAKE)).toBe(false)
    expect(hasType(null, SESSION_HANDSHAKE)).toBe(false)
    expect(hasType(undefined, SESSION_HANDSHAKE)).toBe(false)
  })

  test("rejects an object with no `type` field", () => {
    expect(hasType({ code: "x" }, SESSION_ERROR)).toBe(false)
  })

  test("narrows the return type for the caller", () => {
    const raw: unknown = { type: SESSION_HANDSHAKE, playerId: "p1", token: "t1" }
    if (hasType(raw, SESSION_HANDSHAKE)) {
      // Compiles only if `raw` narrowed to HandshakeReply.
      expect(raw.playerId).toBe("p1")
      expect(raw.token).toBe("t1")
    } else {
      throw new Error("expected hasType to match")
    }
  })
})
