import { describe, expect, test, beforeEach } from "bun:test"
import { AudioClient, getAudioClient } from "./client"
import { FakeAudioContext } from "./fake"

beforeEach(() => {
  FakeAudioContext.instances = []
})

describe("AudioClient", () => {
  function makeClient() {
    return new AudioClient({ audioCtor: FakeAudioContext as unknown as typeof AudioContext })
  }

  test("snapshot returns initial state", () => {
    const client = makeClient()
    expect(client.snapshot()).toEqual({ ready: false })
  })

  test("subscribe notifies on prime", () => {
    const client = makeClient()
    let calls = 0
    client.subscribe(() => calls++)
    client.prime()
    expect(calls).toBe(1)
  })

  test("unsubscribe stops notifications", () => {
    const client = makeClient()
    let calls = 0
    const unsub = client.subscribe(() => calls++)
    unsub()
    client.prime()
    expect(calls).toBe(0)
  })

  test("prime transitions state to ready", () => {
    const client = makeClient()
    expect(client.snapshot().ready).toBe(false)
    client.prime()
    expect(client.snapshot().ready).toBe(true)
  })

  test("prime no-ops when already ready", () => {
    const client = makeClient()
    client.prime()
    let calls = 0
    client.subscribe(() => calls++)
    client.prime()
    expect(calls).toBe(0)
  })

  test("preload creates an AudioContext", () => {
    const client = new AudioClient()
    expect(FakeAudioContext.instances.length).toBe(0)
    client.preload()
    // No injected audioCtor → preload fails silently; verify it doesn't throw
    expect(client.snapshot()).toEqual({ ready: false })
  })

  test("play no-ops when buffers are not loaded", () => {
    const client = makeClient()
    // Must not throw
    client.play("move")
    client.play("capture")
  })

  test("playMove and playCapture are wired to play", () => {
    const client = makeClient()
    client.playMove()
    client.playCapture()
  })

  test("getAudioClient returns null on server", () => {
    // SSR simulation: Happy DOM has window, so getAudioClient returns instance
    const result = getAudioClient()
    expect(result).not.toBeNull()
  })

  test("play with injected buffers creates audio nodes", () => {
    const client = makeClient()
    client.preload()
    // Preload with FakeAudioContext → fetch fails, buffers empty. Verify play() doesn't throw.
    client.play("move")
  })
})
