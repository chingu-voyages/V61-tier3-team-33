import { describe, expect, test } from "bun:test"
import { initialSocketState, reducer, type SocketState } from "./reducer"

describe("reducer", () => {
  test("OPENED resets to open state", () => {
    const dirty: SocketState = {
      status: "reconnecting",
      attempt: 3,
      disconnectedAt: 1000,
    }
    expect(reducer(dirty, { type: "OPENED" })).toEqual({
      status: "open",
      attempt: 0,
      disconnectedAt: null,
    })
  })

  test("first CLOSED starts the disconnect clock", () => {
    const next = reducer(initialSocketState, {
      type: "CLOSED",
      now: 1000,
      maxDisconnectedMs: 5000,
    })
    expect(next).toEqual({
      status: "reconnecting",
      attempt: 1,
      disconnectedAt: 1000,
    })
  })

  test("subsequent CLOSED keeps original disconnectedAt", () => {
    const state: SocketState = {
      status: "reconnecting",
      attempt: 1,
      disconnectedAt: 1000,
    }
    const next = reducer(state, {
      type: "CLOSED",
      now: 2000,
      maxDisconnectedMs: 5000,
    })
    expect(next).toEqual({
      status: "reconnecting",
      attempt: 2,
      disconnectedAt: 1000,
    })
  })

  test("CLOSED transitions to failed once maxDisconnectedMs elapsed", () => {
    const state: SocketState = {
      status: "reconnecting",
      attempt: 2,
      disconnectedAt: 1000,
    }
    const next = reducer(state, {
      type: "CLOSED",
      now: 6000,
      maxDisconnectedMs: 5000,
    })
    expect(next).toEqual({ status: "failed", attempt: 2, disconnectedAt: 1000 })
  })

  test("CLOSED at exactly maxDisconnectedMs is failed (boundary)", () => {
    const state: SocketState = {
      status: "reconnecting",
      attempt: 1,
      disconnectedAt: 0,
    }
    const next = reducer(state, {
      type: "CLOSED",
      now: 5000,
      maxDisconnectedMs: 5000,
    })
    expect(next.status).toBe("failed")
  })

  test("MANUAL_RECONNECT resets to connecting", () => {
    const state: SocketState = {
      status: "failed",
      attempt: 5,
      disconnectedAt: 1000,
    }
    expect(reducer(state, { type: "MANUAL_RECONNECT" })).toEqual({
      status: "connecting",
      attempt: 0,
      disconnectedAt: null,
    })
  })
})
