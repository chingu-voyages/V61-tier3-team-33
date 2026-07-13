import { describe, expect, test } from "bun:test"
import { renderHook } from "@testing-library/react"
import { useSocketContext, SocketContext, type Socket } from "./context"

describe("useSocketContext", () => {
  test("throws outside provider", () => {
    expect(() => renderHook(() => useSocketContext())).toThrow(
      "useSocketContext must be used within a SocketProvider"
    )
  })

  test("returns context value when provided", () => {
    const fakeSocket: Socket = {
      status: "open",
      prevStatus: "connecting",
      attempt: 0,
      send: () => {},
      reconnect: () => {},
      onMessage: () => () => {},
      onAnyMessage: () => () => {},
      onAnySend: () => () => {},
    }
    const { result } = renderHook(() => useSocketContext(), {
      wrapper: ({ children }) => (
        <SocketContext.Provider value={fakeSocket}>
          {children}
        </SocketContext.Provider>
      ),
    })
    expect(result.current).toBe(fakeSocket)
  })
})
