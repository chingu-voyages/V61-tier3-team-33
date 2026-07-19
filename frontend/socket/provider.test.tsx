import { describe, expect, test, beforeEach } from "bun:test"
import { renderHook } from "@testing-library/react"
import { SocketProvider } from "./provider"
import { useSocketContext } from "./context"
import { resetSocketClient } from "./client"
import { FakeSocket } from "./fake"

beforeEach(() => {
  FakeSocket.instances = []
  resetSocketClient()
})

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider
      url="ws://test"
      socketCtor={FakeSocket as unknown as typeof WebSocket}
    >
      {children}
    </SocketProvider>
  )
}

describe("SocketProvider", () => {
  test("provides initial status", () => {
    const { result } = renderHook(() => useSocketContext(), { wrapper })
    expect(result.current.status).toBe("connecting")
  })

  test("status updates on open", () => {
    const { result, rerender } = renderHook(() => useSocketContext(), {
      wrapper,
    })
    FakeSocket.instances[0].triggerOpen()
    rerender()
    expect(result.current.status).toBe("open")
  })

  test("send/reconnect/onMessage are wired to client", () => {
    const { result } = renderHook(() => useSocketContext(), { wrapper })
    FakeSocket.instances[0].triggerOpen()
    FakeSocket.instances[0].readyState = FakeSocket.OPEN
    result.current.onMessage("PING", () => {})
    result.current.send({ foo: "bar" })
    expect(FakeSocket.instances[0].sent).toEqual([
      JSON.stringify({ foo: "bar" }),
    ])
  })

  test("onAnyMessage is wired to client", () => {
    const { result } = renderHook(() => useSocketContext(), { wrapper })
    FakeSocket.instances[0].triggerOpen()
    const received: unknown[] = []
    result.current.onAnyMessage((raw) => received.push(raw))
    FakeSocket.instances[0].triggerMessage({ type: "PING" })
    expect(received).toEqual([{ type: "PING" }])
  })
})
