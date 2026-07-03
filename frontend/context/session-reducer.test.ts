import { describe, expect, test } from "bun:test"
import {
  initialSessionState,
  sessionReducer,
  type SessionState,
} from "./session-reducer"

describe("sessionReducer", () => {
  test("initial state is idle with no player/token/error", () => {
    expect(initialSessionState).toEqual({
      status: "idle",
      playerId: null,
      token: null,
      error: null,
    })
  })

  test("HANDSHAKE_SENT moves to authenticating, preserving other fields", () => {
    const state: SessionState = {
      status: "idle",
      playerId: null,
      token: "stale-token",
      error: { code: "x", message: "y" },
    }
    const next = sessionReducer(state, { type: "HANDSHAKE_SENT" })
    expect(next).toEqual({
      status: "authenticating",
      playerId: null,
      token: "stale-token",
      error: { code: "x", message: "y" },
    })
  })

  test("HANDSHAKE_OK authenticates and clears any prior error", () => {
    const state: SessionState = {
      status: "authenticating",
      playerId: null,
      token: null,
      error: { code: "prev", message: "prev error" },
    }
    const next = sessionReducer(state, {
      type: "HANDSHAKE_OK",
      playerId: "p1",
      token: "t1",
    })
    expect(next).toEqual({
      status: "authenticated",
      playerId: "p1",
      token: "t1",
      error: null,
    })
  })

  test("HANDSHAKE_ERROR sets error and status, preserving playerId/token", () => {
    const state: SessionState = {
      status: "authenticating",
      playerId: "old-player",
      token: "old-token",
      error: null,
    }
    const next = sessionReducer(state, {
      type: "HANDSHAKE_ERROR",
      code: "not-authenticated",
      message: "bad token",
    })
    expect(next).toEqual({
      status: "error",
      playerId: "old-player",
      token: "old-token",
      error: { code: "not-authenticated", message: "bad token" },
    })
  })

  test("HANDSHAKE_OK following an error clears it", () => {
    const errored: SessionState = {
      status: "error",
      playerId: null,
      token: null,
      error: { code: "internal-error", message: "oops" },
    }
    const next = sessionReducer(errored, {
      type: "HANDSHAKE_OK",
      playerId: "p2",
      token: "t2",
    })
    expect(next.error).toBeNull()
    expect(next.status).toBe("authenticated")
  })
})
