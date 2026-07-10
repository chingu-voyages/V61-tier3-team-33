import { describe, expect, test, beforeEach } from "bun:test"
import { render, renderHook, act } from "@testing-library/react"
import { AudioProvider } from "./provider"
import { useSoundContext } from "./context"
import { getAudioClient } from "./client"
import { FakeAudioContext } from "./fake"
import { useEffect, useRef } from "react"

beforeEach(() => {
  FakeAudioContext.instances = []
  // Reset singleton for fresh test
  const global = globalThis as { _chessAudioClient?: unknown }
  delete global._chessAudioClient
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <AudioProvider>{children}</AudioProvider>
}

describe("AudioProvider", () => {
  test("provides initial state (not ready)", () => {
    const { result } = renderHook(() => useSoundContext(), { wrapper })
    expect(result.current.ready).toBe(false)
  })

  test("prime transitions state to ready via injected AudioContext", () => {
    // Inject FakeAudioContext before provider
    getAudioClient({ audioCtor: FakeAudioContext as unknown as typeof AudioContext })

    const { result, rerender } = renderHook(() => useSoundContext(), {
      wrapper,
    })

    expect(result.current.ready).toBe(false)

    act(() => {
      result.current.prime()
    })
    rerender()

    expect(result.current.ready).toBe(true)
  })

  test("preload is callable", () => {
    getAudioClient({ audioCtor: FakeAudioContext as unknown as typeof AudioContext })
    const { result } = renderHook(() => useSoundContext(), { wrapper })
    expect(() => result.current.preload()).not.toThrow()
  })

  test("playMove and playCapture are callable", () => {
    getAudioClient({ audioCtor: FakeAudioContext as unknown as typeof AudioContext })
    const { result } = renderHook(() => useSoundContext(), { wrapper })
    expect(() => result.current.playMove()).not.toThrow()
    expect(() => result.current.playCapture()).not.toThrow()
  })
})

describe("AudioProvider + useSoundContext sound stability", () => {
  test("playMove is called exactly once per moveSeq increment with real provider", () => {
    getAudioClient({ audioCtor: FakeAudioContext as unknown as typeof AudioContext })

    const moveCalls: number[] = []

    function TestComponent({ moveSeq }: { moveSeq: number }) {
      const { playMove } = useSoundContext()
      const prevSeq = useRef(0)

      useEffect(() => {
        if (moveSeq === prevSeq.current) return
        prevSeq.current = moveSeq
        moveCalls.push(moveSeq)
        playMove()
      }, [moveSeq, playMove])

      return null
    }

    const { rerender } = render(
      <AudioProvider>
        <TestComponent moveSeq={1} />
      </AudioProvider>
    )

    // moveSeq=1 → plays once
    expect(moveCalls).toEqual([1])

    // Bump moveSeq
    rerender(
      <AudioProvider>
        <TestComponent moveSeq={2} />
      </AudioProvider>
    )

    expect(moveCalls).toEqual([1, 2])

    // Same moveSeq → no call
    rerender(
      <AudioProvider>
        <TestComponent moveSeq={2} />
      </AudioProvider>
    )

    expect(moveCalls).toEqual([1, 2])
  })

  test("prime does not trigger sound replay", () => {
    getAudioClient({ audioCtor: FakeAudioContext as unknown as typeof AudioContext })

    const moveCalls: number[] = []

    function TestComponent({ moveSeq }: { moveSeq: number }) {
      const { playMove, prime } = useSoundContext()
      const prevSeq = useRef(0)

      useEffect(() => {
        if (moveSeq === prevSeq.current) return
        prevSeq.current = moveSeq
        moveCalls.push(moveSeq)
        playMove()
      }, [moveSeq, playMove])

      // Simulate click — prime then update moveSeq
      useEffect(() => {
        prime()
      }, [prime])

      return null
    }

    render(
      <AudioProvider>
        <TestComponent moveSeq={1} />
      </AudioProvider>
    )

    // prime() triggers ready transition, but effect fires only once for moveSeq
    expect(moveCalls).toEqual([1])
  })
})
