import { describe, expect, test } from "bun:test"
import {
  initialSocketState,
  socketReducer,
  type SocketState,
} from "./socket-reducer"

describe("socketReducer", () => {
  test("initial state is connecting", () => {
    expect(initialSocketState.status).toBe("connecting")
  })

  test("OPENED resets to open, attempt 0, no disconnectedAt", () => {
    const dirty: SocketState = {
      status: "reconnecting",
      attempt: 4,
      disconnectedAt: 1000,
    }
    const next = socketReducer(dirty, { type: "OPENED" })
    expect(next).toEqual({ status: "open", attempt: 0, disconnectedAt: null })
  })

  test("first CLOSED from open starts the disconnected clock", () => {
    const open: SocketState = { status: "open", attempt: 0, disconnectedAt: null }
    const next = socketReducer(open, {
      type: "CLOSED",
      now: 5000,
      maxDisconnectedMs: 110_000,
    })
    expect(next.status).toBe("reconnecting")
    expect(next.attempt).toBe(1)
    expect(next.disconnectedAt).toBe(5000)
  })

  test("subsequent CLOSED keeps the original disconnectedAt, bumps attempt", () => {
    const reconnecting: SocketState = {
      status: "reconnecting",
      attempt: 1,
      disconnectedAt: 5000,
    }
    const next = socketReducer(reconnecting, {
      type: "CLOSED",
      now: 8000, // a later failed attempt
      maxDisconnectedMs: 110_000,
    })
    expect(next.disconnectedAt).toBe(5000) // unchanged
    expect(next.attempt).toBe(2)
    expect(next.status).toBe("reconnecting")
  })

  test("CLOSED transitions to failed once maxDisconnectedMs elapses", () => {
    const reconnecting: SocketState = {
      status: "reconnecting",
      attempt: 5,
      disconnectedAt: 0,
    }
    const next = socketReducer(reconnecting, {
      type: "CLOSED",
      now: 110_000,
      maxDisconnectedMs: 110_000,
    })
    expect(next.status).toBe("failed")
  })

  test("CLOSED at exactly the boundary counts as expired (>=, not >)", () => {
    const reconnecting: SocketState = {
      status: "reconnecting",
      attempt: 1,
      disconnectedAt: 0,
    }
    const next = socketReducer(reconnecting, {
      type: "CLOSED",
      now: 110_000,
      maxDisconnectedMs: 110_000,
    })
    expect(next.status).toBe("failed")
  })

  test("MANUAL_RECONNECT resets to connecting, attempt 0", () => {
    const failed: SocketState = {
      status: "failed",
      attempt: 8,
      disconnectedAt: 12345,
    }
    const next = socketReducer(failed, { type: "MANUAL_RECONNECT" })
    expect(next).toEqual({
      status: "connecting",
      attempt: 0,
      disconnectedAt: null,
    })
  })
})
