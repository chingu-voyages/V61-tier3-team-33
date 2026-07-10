// Singleton audio engine for game sound effects, mirroring socket/client.ts:
// one instance lives on `globalThis` (survives remounts/HMR), and exposes
// subscribe/snapshot so React can read it via useSyncExternalStore instead
// of ad-hoc refs/effects in every component that wants to play a sound.

export type SoundName = "move" | "capture"

export interface AudioClientState {
  ready: boolean
}

type Listener = () => void

export interface AudioClientOptions {
  audioCtor?: typeof AudioContext
}

const SOUND_FILES: Record<SoundName, string> = {
  move: "/sounds/Move.mp3",
  capture: "/sounds/Capture.mp3",
}

const SOUND_VOLUME: Record<SoundName, number> = {
  move: 0.4,
  capture: 0.48,
}

export class AudioClient {
  private ctx: AudioContext | null = null
  private audioCtor?: typeof AudioContext
  private buffers: Partial<Record<SoundName, AudioBuffer>> = {}
  private loadPromise: Promise<void> | null = null
  private activeVoice: { source: AudioBufferSourceNode; gain: GainNode } | null = null
  private playToken = 0
  private listeners: Set<Listener> = new Set()
  private state: AudioClientState = { ready: false }

  constructor(opts: AudioClientOptions = {}) {
    if (opts.audioCtor) this.audioCtor = opts.audioCtor
  }

  snapshot = (): AudioClientState => this.state

  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private setState(partial: Partial<AudioClientState>) {
    this.state = { ...this.state, ...partial }
    for (const cb of this.listeners) cb()
  }

  /**
   * Create the AudioContext and start decoding sound buffers immediately.
   * Safe to call without a user gesture — decodeAudioData works on a
   * suspended context; only playback (start()) needs a gesture. Calling this
   * as early as possible (e.g. app mount, via AudioProvider) means buffers
   * are already decoded by the time a real move happens, avoiding a
   * deferred-play race where a slow first sound and a fast second one could
   * both end up queued on the same load promise and fire back-to-back.
   */
  preload = (): void => {
    if (!this.ctx) {
      try {
        this.ctx = new (this.audioCtor ?? AudioContext)()
      } catch {
        return
      }
    }
    void this.ensureLoaded()
  }

  /** Must be called from a user gesture to unlock audio playback. */
  prime = (): void => {
    if (this.state.ready) return
    this.preload()
    if (!this.ctx) return
    this.ctx.resume()
    this.setState({ ready: true })
  }

  private ensureLoaded(): Promise<void> {
    if (this.buffers.move && this.buffers.capture) return Promise.resolve()
    if (this.loadPromise) return this.loadPromise
    const ctx = this.ctx
    if (!ctx) return Promise.resolve()

    this.loadPromise = (async () => {
      const entries = Object.entries(SOUND_FILES) as [SoundName, string][]
      await Promise.all(
        entries.map(async ([name, url]) => {
          try {
            const res = await fetch(url)
            if (!res.ok) return
            const arrayBuf = await res.arrayBuffer()
            this.buffers[name] = await ctx.decodeAudioData(arrayBuf)
          } catch {
            // leave missing; play() will just no-op for this sound
          }
        })
      )
    })()

    return this.loadPromise
  }

  play = (name: SoundName): void => {
    const ctx = this.ctx
    const buf = this.buffers[name]
    if (!ctx || !buf) {
      // Buffers should normally already be decoded via preload(). If we get
      // here it's a genuine edge case (e.g. play() fired before preload had
      // a chance to run) — drop the sound rather than deferring, since a
      // deferred call can land on top of a later move's own play() and
      // sound like a duplicate.
      return
    }

    // Hard mutex: only one voice may ever sound at once. Kill anything still
    // ringing instead of letting it stack with the new sound.
    if (this.activeVoice) {
      try {
        this.activeVoice.gain.gain.cancelScheduledValues(ctx.currentTime)
        this.activeVoice.gain.gain.setValueAtTime(0, ctx.currentTime)
        this.activeVoice.source.stop(ctx.currentTime)
      } catch {
        // already stopped
      }
      this.activeVoice = null
    }

    const token = ++this.playToken
    const now = ctx.currentTime
    const volume = SOUND_VOLUME[name]

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    source.buffer = buf
    filter.type = "lowpass"
    filter.frequency.value = 9000 // gentle de-harshing only; keeps the transient crisp
    filter.Q.value = 0.707 // Butterworth — flat response, no resonant peak/clipping

    // Short attack/release envelope avoids the click/pop of a hard start-stop
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.008)
    gain.gain.setTargetAtTime(0, now + buf.duration - 0.05, 0.03)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    this.activeVoice = { source, gain }
    source.onended = () => {
      if (this.playToken === token) this.activeVoice = null
    }

    source.start(now)
  }

  playMove = (): void => this.play("move")
  playCapture = (): void => this.play("capture")
}

declare global {
  var _chessAudioClient: AudioClient | undefined
}

/**
 * Get or create the singleton AudioClient.
 * Pass `opts` on the **first** call to control DI (e.g. AudioContext constructor).
 * Subsequent calls (including from AudioProvider) always return the same instance.
 */
export function getAudioClient(opts?: AudioClientOptions): AudioClient | null {
  if (typeof window === "undefined") return null
  if (!globalThis._chessAudioClient) {
    globalThis._chessAudioClient = new AudioClient(opts)
  }
  return globalThis._chessAudioClient
}
