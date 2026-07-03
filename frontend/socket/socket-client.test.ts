import { describe, expect, mock, test } from "bun:test"
import { SocketClient } from "./socket-client"
import { FakeWebSocket } from "./fake-websocket"

function makeClient() {
  FakeWebSocket.reset()
  const client = new SocketClient("ws://test/ws", {
    retryConfig: { baseDelayMs: 10, maxDelayMs: 50, jitterRatio: 0 },
    maxDisconnectedMs: 200,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  })
  return { client }
}

describe("SocketClient", () => {
  test("connects immediately on construction", () => {
    makeClient()
    expect(FakeWebSocket.instances.length).toBe(1)
  })

  test("status starts as connecting", () => {
    const { client } = makeClient()
    expect(client.getSnapshot()).toBe("connecting")
  })

  test("status becomes open once the socket opens", () => {
    const { client } = makeClient()
    FakeWebSocket.latest().triggerOpen()
    expect(client.getSnapshot()).toBe("open")
  })

  test("notifies subscribers on every status change", () => {
    const { client } = makeClient()
    const listener = mock(() => {})
    client.subscribe(listener)

    FakeWebSocket.latest().triggerOpen()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test("unsubscribe stops further notifications", () => {
    const { client } = makeClient()
    const listener = mock(() => {})
    const unsubscribe = client.subscribe(listener)
    unsubscribe()

    FakeWebSocket.latest().triggerOpen()

    expect(listener).not.toHaveBeenCalled()
  })

  test("parses incoming messages and forwards them to onMessage subscribers", () => {
    const { client } = makeClient()
    const onMessage = mock(() => {})
    client.onMessage(onMessage)
    FakeWebSocket.latest().triggerOpen()

    FakeWebSocket.latest().triggerMessage({ type: "room:joined", roomId: "r1" })

    expect(onMessage).toHaveBeenCalledWith({ type: "room:joined", roomId: "r1" })
  })

  test("delivers each message to every subscriber independently", () => {
    const { client } = makeClient()
    const first = mock(() => {})
    const second = mock(() => {})
    client.onMessage(first)
    client.onMessage(second)
    FakeWebSocket.latest().triggerOpen()

    FakeWebSocket.latest().triggerMessage({ type: "move:made" })

    expect(first).toHaveBeenCalledWith({ type: "move:made" })
    expect(second).toHaveBeenCalledWith({ type: "move:made" })
  })

  test("onMessage unsubscribe stops further delivery to that handler only", () => {
    const { client } = makeClient()
    const stays = mock(() => {})
    const leaves = mock(() => {})
    client.onMessage(stays)
    const unsubscribe = client.onMessage(leaves)
    unsubscribe()
    FakeWebSocket.latest().triggerOpen()

    FakeWebSocket.latest().triggerMessage({ type: "move:made" })

    expect(stays).toHaveBeenCalledTimes(1)
    expect(leaves).not.toHaveBeenCalled()
  })

  test("send() writes JSON to the socket when open", () => {
    const { client } = makeClient()
    FakeWebSocket.latest().triggerOpen()

    client.send({ type: "move:make", from: 1, to: 2 })

    expect(FakeWebSocket.latest().sent).toEqual([
      JSON.stringify({ type: "move:make", from: 1, to: 2 }),
    ])
  })

  test("send() is a no-op when the socket isn't open", () => {
    const { client } = makeClient()
    // never opened
    client.send({ type: "move:make", from: 1, to: 2 })
    expect(FakeWebSocket.latest().sent).toEqual([])
  })

  test("reconnects automatically after a close, opening a new socket", async () => {
    const { client } = makeClient()
    FakeWebSocket.latest().triggerOpen()

    FakeWebSocket.latest().triggerClose()
    expect(client.getSnapshot()).toBe("reconnecting")

    // baseDelayMs: 10ms in the test config — wait past it.
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(FakeWebSocket.instances.length).toBe(2)
  })

  test("gives up and reaches failed once maxDisconnectedMs elapses", async () => {
    const { client } = makeClient()
    FakeWebSocket.latest().triggerOpen()
    FakeWebSocket.latest().triggerClose()

    // Keep failing every retry until the 200ms disconnected budget is spent.
    for (let i = 0; i < 10 && client.getSnapshot() !== "failed"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 30))
      if (client.getSnapshot() === "reconnecting") {
        FakeWebSocket.latest().triggerClose()
      }
    }

    expect(client.getSnapshot()).toBe("failed")
  })

  test("reconnect() is a no-op unless status is failed", () => {
    const { client } = makeClient()
    FakeWebSocket.latest().triggerOpen()
    const countBefore = FakeWebSocket.instances.length

    client.reconnect()

    expect(FakeWebSocket.instances.length).toBe(countBefore)
    expect(client.getSnapshot()).toBe("open")
  })

  test("reconnect() from failed starts a fresh connection attempt", async () => {
    FakeWebSocket.reset()
    // maxDisconnectedMs: 0 — the very first close reaches "failed" immediately.
    const client = new SocketClient("ws://test/ws", {
      retryConfig: { baseDelayMs: 10, maxDelayMs: 50, jitterRatio: 0 },
      maxDisconnectedMs: 0,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    })

    FakeWebSocket.latest().triggerOpen()
    FakeWebSocket.latest().triggerClose()
    expect(client.getSnapshot()).toBe("failed")

    const countBeforeReconnect = FakeWebSocket.instances.length
    client.reconnect()

    expect(client.getSnapshot()).toBe("connecting")
    expect(FakeWebSocket.instances.length).toBe(countBeforeReconnect + 1)
  })

  test("destroy() stops delivering messages and future reconnects", () => {
    const { client } = makeClient()
    const onMessage = mock(() => {})
    client.onMessage(onMessage)
    FakeWebSocket.latest().triggerOpen()

    client.destroy()
    FakeWebSocket.latest().triggerMessage({ type: "move:made" })

    expect(onMessage).not.toHaveBeenCalled()
  })
})
