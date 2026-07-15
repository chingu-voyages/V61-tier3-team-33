import { describe, expect, test, beforeEach, spyOn } from "bun:test"
import { renderHook, act } from "@testing-library/react"
import { SocketProvider } from "@/socket/provider"
import { resetSocketClient } from "@/socket/client"
import { FakeSocket } from "@/socket/fake"
import { RoomProvider } from "./provider"
import { gooeyToast } from "@/components/ui/goey-toaster"
import {
  GAME_NOT_FOUND,
  INVALID_MODE,
  NO_HISTORY,
  NOT_ALLOWED,
  NOT_SEATED,
  NOT_YOUR_TURN,
  PENDING_CONFLICT,
  RATE_LIMITED,
  ROOM_FULL,
  SESSION_ERROR,
  UNDO_INACTIVE,
} from "@/socket/errors"

beforeEach(() => {
  FakeSocket.instances = []
  resetSocketClient()
})

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SocketProvider
        url="ws://test"
        socketCtor={FakeSocket as unknown as typeof WebSocket}
      >
        <RoomProvider>{children}</RoomProvider>
      </SocketProvider>
    )
  }
}

describe("useConnectionToast", () => {
  test("shows Connecting toast on initial mount", () => {
    const infoSpy = spyOn(gooeyToast, "info")

    renderHook(() => null, { wrapper: createWrapper() })

    expect(infoSpy).toHaveBeenCalledWith(
      "Connecting",
      expect.objectContaining({ id: "connection-connecting" })
    )
  })

  test("transitions to Connected when socket opens", () => {
    const successSpy = spyOn(gooeyToast, "success")
    const dismissSpy = spyOn(gooeyToast, "dismiss")

    const { rerender } = renderHook(() => null, { wrapper: createWrapper() })

    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    rerender()

    expect(dismissSpy).toHaveBeenCalledWith("connection-connecting")
    expect(successSpy).toHaveBeenCalledWith(
      "Connected",
      expect.objectContaining({ id: "connection-open" })
    )
  })

  test("does not dismiss Connected toast before CONNECTED_DISMISS_MS", () => {
    const successSpy = spyOn(gooeyToast, "success")

    const { rerender } = renderHook(() => null, { wrapper: createWrapper() })

    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    rerender()

    expect(successSpy).toHaveBeenCalledWith(
      "Connected",
      expect.objectContaining({ id: "connection-open" })
    )
  })

  test("dismisses old toast on disconnect after open", () => {
    const dismissSpy = spyOn(gooeyToast, "dismiss")

    const { rerender } = renderHook(() => null, { wrapper: createWrapper() })
    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    rerender()

    dismissSpy.mockClear()
    act(() => {
      FakeSocket.instances[0].triggerClose()
    })
    rerender()

    expect(dismissSpy).toHaveBeenCalledWith("connection-open")
  })

  test("transitions to Reconnecting when socket closes without opening", () => {
    const warningSpy = spyOn(gooeyToast, "warning")
    const dismissSpy = spyOn(gooeyToast, "dismiss")

    const { rerender } = renderHook(() => null, { wrapper: createWrapper() })

    // Socket closes immediately without ever opening
    act(() => {
      FakeSocket.instances[0].triggerClose()
    })
    rerender()

    expect(dismissSpy).toHaveBeenCalledWith("connection-connecting")
    expect(warningSpy).toHaveBeenCalledWith(
      "Reconnecting",
      expect.objectContaining({ id: "connection-reconnecting" })
    )
  })

  test("transitions to Connection failed after maxDisconnectedMs", async () => {
    const errorSpy = spyOn(gooeyToast, "error")

    const { rerender } = renderHook(() => null, { wrapper: createWrapper() })

    act(() => {
      FakeSocket.instances[0].triggerClose()
    })
    rerender()

    errorSpy.mockClear()

    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe("undo error toasts", () => {
  test.each([
    [NO_HISTORY, "There are no moves to undo yet"],
    [PENDING_CONFLICT, "There's already a pending undo request"],
    [NOT_ALLOWED, "Cannot request undo again without a move in between"],
    [NOT_YOUR_TURN, "It's not your turn to request an undo"],
    [GAME_NOT_FOUND, "This game no longer exists"],
    [UNDO_INACTIVE, "You cannot undo — the game is not active"],
    [NOT_SEATED, "You cannot resign — you are not seated in this game"],
    [RATE_LIMITED, "Please wait a moment before requesting an undo again"],
    [ROOM_FULL, "The room is full."],
    [INVALID_MODE, "Cannot join in the current game state."],
  ] as const)("shows toast for %s error", (code, expectedMessage) => {
    const errorSpy = spyOn(gooeyToast, "error")

    const { rerender } = renderHook(() => null, { wrapper: createWrapper() })

    // wait for open
    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    rerender()

    errorSpy.mockClear()

    // send a session:error with the given code
    act(() => {
      FakeSocket.instances[0].triggerMessage({
        type: SESSION_ERROR,
        code,
        message: expectedMessage,
      })
    })

    expect(errorSpy).toHaveBeenCalledWith(expectedMessage)
  })
})
