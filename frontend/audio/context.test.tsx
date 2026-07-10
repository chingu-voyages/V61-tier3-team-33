import { describe, expect, test } from "bun:test"
import { renderHook } from "@testing-library/react"
import { useSoundContext, SoundContext, type Sound } from "./context"

describe("useSoundContext", () => {
  test("throws outside provider", () => {
    expect(() => renderHook(() => useSoundContext())).toThrow(
      "useSoundContext must be used within an AudioProvider"
    )
  })

  test("returns context value when provided", () => {
    const fakeSound: Sound = {
      ready: true,
      prime: () => {},
      preload: () => {},
      playMove: () => {},
      playCapture: () => {},
    }
    const { result } = renderHook(() => useSoundContext(), {
      wrapper: ({ children }) => (
        <SoundContext.Provider value={fakeSound}>
          {children}
        </SoundContext.Provider>
      ),
    })
    expect(result.current).toBe(fakeSound)
  })
})
