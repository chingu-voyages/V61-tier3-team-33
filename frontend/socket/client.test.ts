import { describe, expect, test, beforeEach } from "bun:test"
import SocketClient from "./client"
import { FakeSocket } from "./fake"

beforeEach(() => {
  FakeSocket.instances = []
})

describe("SocketClient", () => {
  function makeClient(opts = {}) {
    return new SocketClient("ws://test", {
      socketCtor: FakeSocket as unknown as typeof WebSocket,
      maxDisconnectedMs: 5000,
      retryConfig: { baseDelayMs: 10, maxDelayMs: 100, jitterRatio: 0 },
      ...opts,
    })
  }

  test("starts connecting", () => {
    const client = makeClient()
    expect(client.snapshot().status).toBe("connecting")
  })

  test("OPENED sets status to open", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    expect(client.snapshot().status).toBe("open")
  })

  test("notifies status subscribers", () => {
    const client = makeClient()
    let calls = 0
    client.subscribe(() => calls++)
    FakeSocket.instances[0].triggerOpen()
    expect(calls).toBe(1)
  })

  test("delivers messages by type", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    client.onMessage("PING", (raw) => received.push(raw))
    FakeSocket.instances[0].triggerMessage({ type: "PING" })
    expect(received).toEqual([{ type: "PING" }])
  })

  test("ignores messages of a different type", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    client.onMessage("PING", (raw) => received.push(raw))
    FakeSocket.instances[0].triggerMessage({ type: "PONG" })
    expect(received).toEqual([])
  })

  test("drops malformed messages silently", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    client.onMessage("PING", (raw) => received.push(raw))
    FakeSocket.instances[0].onmessage?.({ data: "not json" } as MessageEvent)
    expect(received).toEqual([])
  })

  test("onAnyMessage receives all messages regardless of type", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    client.onAnyMessage((raw) => received.push(raw))
    FakeSocket.instances[0].triggerMessage({ type: "PING" })
    FakeSocket.instances[0].triggerMessage({ type: "PONG" })
    expect(received).toEqual([{ type: "PING" }, { type: "PONG" }])
  })

  test("onAnyMessage unsubscribe stops delivery", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    const unsubscribe = client.onAnyMessage((raw) => received.push(raw))
    unsubscribe()
    FakeSocket.instances[0].triggerMessage({ type: "PING" })
    expect(received).toEqual([])
  })

  test("onMessage unsubscribe stops delivery", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    const unsubscribe = client.onMessage("PING", (raw) => received.push(raw))
    unsubscribe()
    FakeSocket.instances[0].triggerMessage({ type: "PING" })
    expect(received).toEqual([])
  })

  test("CLOSED reconnects by creating a new socket", async () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    FakeSocket.instances[0].triggerClose()
    expect(client.snapshot().status).toBe("reconnecting")
    await new Promise((r) => setTimeout(r, 50))
    expect(FakeSocket.instances.length).toBe(2)
  })

  test("reaches failed after maxDisconnectedMs", () => {
    const client = makeClient({ maxDisconnectedMs: 0 })
    FakeSocket.instances[0].triggerClose()
    expect(client.snapshot().status).toBe("failed")
  })

  test("reconnect() transitions from failed to connecting", () => {
    const client = makeClient({ maxDisconnectedMs: 0 })
    FakeSocket.instances[0].triggerClose()
    expect(client.snapshot().status).toBe("failed")
    client.reconnect()
    expect(client.snapshot().status).toBe("connecting")
  })

  test("reconnect() no-ops when not failed", () => {
    const client = makeClient()
    const statusBefore = client.snapshot().status
    client.reconnect()
    expect(client.snapshot().status).toBe(statusBefore)
  })

  test("send() no-ops when not open", () => {
    const client = makeClient()
    client.send({ foo: "bar" })
    expect(FakeSocket.instances[0].sent).toEqual([])
  })

  test("send() writes when open", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    FakeSocket.instances[0].readyState = FakeSocket.OPEN
    client.send({ foo: "bar" })
    expect(FakeSocket.instances[0].sent).toEqual([
      JSON.stringify({ foo: "bar" }),
    ])
  })

  test("onAnySend observes outbound messages", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    FakeSocket.instances[0].readyState = FakeSocket.OPEN
    const observed: unknown[] = []
    client.onAnySend((raw) => observed.push(raw))
    client.send({ type: "ping" })
    expect(observed).toEqual([{ type: "ping" }])
  })

  test("onAnySend unsubscribe stops observing", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    FakeSocket.instances[0].readyState = FakeSocket.OPEN
    const observed: unknown[] = []
    const unsub = client.onAnySend((raw) => observed.push(raw))
    unsub()
    client.send({ type: "ping" })
    expect(observed).toEqual([])
  })

  test("message without type does not crash", () => {
    const client = makeClient()
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    client.onMessage("PING" as any, (raw) => received.push(raw))
    FakeSocket.instances[0].triggerMessage({ noType: true })
    expect(received).toEqual([])
  })

  test("destroy() prevents dispatch after cleanup", () => {
    const client = makeClient()
    client.destroy()
    FakeSocket.instances[0].triggerOpen()
    expect(client.snapshot().status).toBe("connecting")
  })

  test("destroy() clears listeners and stops reconnecting", () => {
    const client = makeClient()
    client.destroy()
    FakeSocket.instances[0].triggerClose()
    expect(FakeSocket.instances.length).toBe(1)
  })

  test("isDestroyed reflects destroy state", () => {
    const client = makeClient()
    expect(client.isDestroyed).toBe(false)
    client.destroy()
    expect(client.isDestroyed).toBe(true)
  })
})
