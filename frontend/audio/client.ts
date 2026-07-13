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
  private activeVoice: {
    source: AudioBufferSourceNode
    gain: GainNode
  } | null = null
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

  /** Create AudioContext, start decoding buffers early — avoids deferred-play race between moves. */
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

  /** Unlock audio playback — must be called from a user gesture. */
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
            // Missing — play() no-ops
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
      // Edge case: play() before preload. Drop rather than defer to avoid duplicates.
      return
    }

    // Hard mutex — kill active voice to prevent stacking.
    if (this.activeVoice) {
      try {
        this.activeVoice.gain.gain.cancelScheduledValues(ctx.currentTime)
        this.activeVoice.gain.gain.setValueAtTime(0, ctx.currentTime)
        this.activeVoice.source.stop(ctx.currentTime)
      } catch {
        // Already stopped
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
    filter.frequency.value = 9000 // Gentle de-harshing, keeps transient crisp
    filter.Q.value = 0.707 // Butterworth — flat response, no clipping

    // Short envelope avoids click/pop.
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

/** Get or create singleton AudioClient. Pass opts on first call for DI. */
export function getAudioClient(opts?: AudioClientOptions): AudioClient | null {
  if (typeof window === "undefined") return null
  if (!globalThis._chessAudioClient) {
    globalThis._chessAudioClient = new AudioClient(opts)
  }
  return globalThis._chessAudioClient
}
