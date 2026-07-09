import { describe, test, expect, beforeEach, mock } from "bun:test"

// Mock must be registered before use-connection.ts (and its import of
// goey-toaster) is loaded below.
type ToastCall = { type: string; title: string; opts: Record<string, unknown> }
let created: ToastCall[] = []
let updated: { id: string; opts: Record<string, unknown> }[] = []
let dismissed: string[] = []
let visibleToast: ToastCall | null = null
let updatesMounted = true

function record(type: string) {
  return (title: string, opts: Record<string, unknown> = {}) => {
    const call = { type, title, opts }
    created.push(call)
    visibleToast = call
    return "mock-id"
  }
}

mock.module("@/components/ui/goey-toaster", () => ({
  gooeyToast: {
    info: record("info"),
    warning: record("warning"),
    error: record("error"),
    success: record("success"),
    update: (id: string, opts: Record<string, unknown>) => {
      updated.push({ id, opts })
      if (!updatesMounted) return
      visibleToast = {
        type: String(opts.type ?? visibleToast?.type ?? "default"),
        title: String(opts.title ?? visibleToast?.title ?? ""),
        opts: { ...visibleToast?.opts, ...opts },
      }
    },
    dismiss: (id: string) => {
      dismissed.push(id)
      visibleToast = null
    },
  },
}))

import { act, renderHook } from "@testing-library/react"
import { SocketProvider } from "../socket/provider"
import { resetSocketClient } from "../socket/client"
import { FakeSocket } from "../socket/fake"
import { SocketContext, type Socket } from "../socket/context"
import { useConnection } from "./use-connection"

// Zero-delay retry config so the client's real (but 0ms) setTimeout-based
// reconnect fires after a single macrotask flush instead of requiring real
// fake-timer machinery. Without this, SocketClient schedules the next
// connect() ~1000ms+ out (see lib/retry.ts backoffDelay), and any test that
// needs a *second* FakeSocket instance (Flow C, D) would find
// `FakeSocket.instances[1]` undefined.
const INSTANT_RETRY = { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 }

// Flushes a real (possibly 0ms) timer queue — needed after triggering a
// close whenever the client is expected to schedule/execute a reconnect.
function flushTimers() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider
      url="ws://test"
      retryConfig={INSTANT_RETRY}
      socketCtor={FakeSocket as unknown as typeof WebSocket}
    >
      {children}
    </SocketProvider>
  )
}

beforeEach(() => {
  FakeSocket.instances = []
  resetSocketClient()
  created = []
  updated = []
  dismissed = []
  visibleToast = null
  updatesMounted = true
})

describe("useConnection", () => {
  // Flow A: fresh load, connects immediately.
  test("shows 'Connecting' (never 'Connection lost') on the very first render", () => {
    renderHook(() => useConnection(), { wrapper })

    // This is the bug that was reported: the first-ever status used to be
    // silently skipped, so nothing was created here and the *next*
    // transition wrongly announced itself as a "lost" connection.
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ type: "info", title: "Connecting" })
    // Must never auto-collapse via the library's internal 4s timer.
    expect(created[0].opts.timing).toEqual({ displayDuration: 86400000 })
  })

  test("Flow A: immediate success dismisses silently, no 'Connected' flash", () => {
    renderHook(() => useConnection(), { wrapper })

    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })

    // No success toast — only the original "Connecting" toast, followed by
    // an immediate dismiss.
    expect(created).toHaveLength(1)
    expect(updated).toHaveLength(0)
    expect(dismissed).toEqual(["connection-status"])
  })

  // Flow B: never connected, drops into reconnecting, then recovers.
  test("Flow B: first-load retry stays in a connecting state, not connection lost", () => {
    renderHook(() => useConnection(), { wrapper })

    act(() => {
      FakeSocket.instances[0].triggerClose()
    })

    expect(updated).toHaveLength(1)
    expect(updated[0].opts).toMatchObject({
      title: "Connecting",
      type: "warning",
    })
    expect(updated[0].opts.description).not.toMatch(/lost/i)
  })

  test("Flow B: fast first-load retry keeps one visible toast and patches it after listeners mount", async () => {
    updatesMounted = false
    renderHook(() => useConnection(), { wrapper })

    act(() => {
      FakeSocket.instances[0].triggerClose()
    })

    expect(created).toHaveLength(1)
    expect(visibleToast).toMatchObject({ type: "info", title: "Connecting" })

    updatesMounted = true
    await act(async () => {
      await flushTimers()
    })

    expect(created).toHaveLength(1)
    expect(visibleToast).toMatchObject({
      type: "warning",
      title: "Connecting",
    })
  })

  // Flow C: was open, drops, recovers -> should say "Reconnecting" this
  // time, then dismiss when the socket recovers.
  test("Flow C: drop-after-success says 'Reconnecting', then dismisses on recovery", async () => {
    renderHook(() => useConnection(), { wrapper })

    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    expect(dismissed).toEqual(["connection-status"])

    await act(async () => {
      FakeSocket.instances[0].triggerClose()
      // With status "reconnecting", SocketClient schedules its next
      // connect() via a real (instant, thanks to INSTANT_RETRY) setTimeout
      // rather than calling it synchronously — flush that macrotask so the
      // second FakeSocket instance actually gets created.
      await flushTimers()
    })
    // Toast was dismissed after the first open, so this recreates it.
    expect(created).toHaveLength(2)
    expect(created[1]).toMatchObject({ type: "warning", title: "Reconnecting" })

    expect(FakeSocket.instances[1]).toBeDefined()
    act(() => {
      FakeSocket.instances[1].triggerOpen()
    })
    expect(dismissed).toEqual(["connection-status", "connection-status"])
  })

  // Flow D: was open, drops, exhausts retries -> persistent error + Retry.
  // maxDisconnectedMs: 0 makes the very first CLOSED after "open" trip
  // straight to "failed" (elapsed 0 >= 0), so this is deterministic.
  test("Flow D: exhausting retries after being connected shows Disconnected + Retry", () => {
    function failFastWrapper({ children }: { children: React.ReactNode }) {
      return (
        <SocketProvider
          url="ws://test"
          retryConfig={INSTANT_RETRY}
          socketCtor={FakeSocket as unknown as typeof WebSocket}
          maxDisconnectedMs={0}
        >
          {children}
        </SocketProvider>
      )
    }

    renderHook(() => useConnection(), { wrapper: failFastWrapper })

    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    expect(dismissed).toEqual(["connection-status"])

    act(() => {
      // maxDisconnectedMs: 0 trips straight to "failed" (no reconnecting
      // step, so no timer to flush here).
      FakeSocket.instances[0].triggerClose()
    })

    // The toast was dismissed after the open above (toastCreated.current
    // reset to false), and status jumps straight open -> failed with no
    // intermediate "reconnecting" render (maxDisconnectedMs: 0) — so
    // patch() takes its !toastCreated.current branch and recreates via
    // gooeyToast.error(...) rather than update(). This lands in `created`,
    // not `updated`, same as the Flow C recreate-after-dismiss case.
    const last = created.at(-1)
    expect(last).toBeDefined()
    expect(last!.type).toBe("error")
    expect(last!.title).toBe("Disconnected")
    expect(
      (last!.opts.action as { label: string }).label
    ).toBe("Retry")
    expect(last!.opts.description).toMatch(/reconnect/i)
  })

  // Flow E: never connected at all, exhausts retries -> wording shouldn't
  // claim a "reconnect" since there was nothing to reconnect to.
  test("Flow E: exhausting retries on first-ever connect doesn't say 'reconnect'", () => {
    function failFastWrapper({ children }: { children: React.ReactNode }) {
      return (
        <SocketProvider
          url="ws://test"
          socketCtor={FakeSocket as unknown as typeof WebSocket}
          maxDisconnectedMs={0}
        >
          {children}
        </SocketProvider>
      )
    }

    renderHook(() => useConnection(), { wrapper: failFastWrapper })

    act(() => {
      FakeSocket.instances[0].triggerClose()
    })

    const last = updated.at(-1)
    expect(last).toBeDefined()
    expect(last!.opts).toMatchObject({ title: "Connection failed", type: "error" })
    expect(last!.opts.description).not.toMatch(/reconnect/i)
  })

  test("reconnecting patches the existing toast in place instead of recreating it", () => {
    renderHook(() => useConnection(), { wrapper })

    act(() => {
      FakeSocket.instances[0].triggerOpen()
    })
    act(() => {
      FakeSocket.instances[0].triggerClose()
    })

    // The drop after "open" should create one replacement toast because the
    // clean initial connection dismissed the first one. Later attempts patch
    // that same visible toast instead of recreating it.
    expect(created).toHaveLength(2) // initial "Connecting" + recreate on drop
    expect(updated).toHaveLength(0)
    expect(visibleToast?.opts).toMatchObject({
      description: expect.stringMatching(/attempt/i),
    })

    // NOTE: verifying that a *second* drop (attempt 2, 3, ...) patches
    // rather than recreates would require advancing the client's real
    // exponential-backoff timers (SocketClient schedules the next
    // connect() via setTimeout), which this harness doesn't fake. That
    // path is exercised by the `patch()` helper itself for any repeat
    // "reconnecting" render — same code path already covered above.
  })

  test("reconnecting attempt bumps patch the same visible toast without recreating", () => {
    let socket: Socket = {
      status: "reconnecting",
      attempt: 1,
      send: () => {},
      reconnect: () => {},
      onMessage: () => () => {},
      onAnyMessage: () => () => {},
      onAnySend: () => () => {},
    }

    function manualWrapper({ children }: { children: React.ReactNode }) {
      return (
        <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
      )
    }

    const { rerender } = renderHook(() => useConnection(), {
      wrapper: manualWrapper,
    })

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      type: "warning",
      title: "Connecting",
    })

    socket = { ...socket, attempt: 2 }
    rerender()
    socket = { ...socket, attempt: 3 }
    rerender()

    expect(created).toHaveLength(1)
    expect(updated.at(-1)?.opts).toMatchObject({
      title: "Connecting",
      description: "Attempting to connect... (attempt 3)",
      type: "warning",
    })
  })
})
