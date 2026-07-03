import { backoffDelay, type RetryConfig } from "@/lib/retry"
import {
  initialSocketState,
  socketReducer,
  type SocketAction,
  type SocketState,
  type SocketStatus,
} from "./socket-reducer"

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  jitterRatio: 0.1,
}

// Slightly under the server's 2-minute disconnected-session TTL, so the
// client gives up before the server would've dropped the session anyway.
export const DEFAULT_MAX_DISCONNECTED_MS = 110_000

export interface SocketClientOptions {
  retryConfig?: RetryConfig
  maxDisconnectedMs?: number
  // Injected so tests can supply a fake instead of a real WebSocket.
  WebSocketImpl?: typeof WebSocket
}

type Listener = () => void
type MessageListener = (raw: unknown) => void

/**
 * Owns one WebSocket connection's full lifecycle: connect, reconnect with
 * backoff, and delivery to subscribers. Lives outside React — components
 * only read from it via useSyncExternalStore. Construct once per app
 * session; call destroy() to tear down for good (e.g. logout).
 *
 * Message delivery is fan-out: any number of features can call
 * onMessage() independently and each gets every inbound frame.
 */
export class SocketClient {
  private ws: InstanceType<typeof WebSocket> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private state: SocketState = initialSocketState
  private listeners = new Set<Listener>()
  private messageListeners = new Set<MessageListener>()
  private destroyed = false

  private readonly retryConfig: RetryConfig
  private readonly maxDisconnectedMs: number
  private readonly WebSocketImpl: typeof WebSocket

  constructor(
    private readonly url: string,
    options: SocketClientOptions = {}
  ) {
    this.retryConfig = options.retryConfig ?? DEFAULT_RETRY_CONFIG
    this.maxDisconnectedMs =
      options.maxDisconnectedMs ?? DEFAULT_MAX_DISCONNECTED_MS
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket
    this.connect()
  }

  /** For useSyncExternalStore's subscribe. */
  subscribe = (callback: Listener): (() => void) => {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /** For useSyncExternalStore's getSnapshot. Returns the status string
   * directly, which is referentially stable when unchanged. */
  getSnapshot = (): SocketStatus => this.state.status

  /**
   * Subscribe to every inbound message; filter by `raw.type` in your own
   * handler. Returns an unsubscribe function.
   */
  onMessage = (handler: MessageListener): (() => void) => {
    this.messageListeners.add(handler)
    return () => this.messageListeners.delete(handler)
  }

  send = (command: object): void => {
    if (!this.ws || this.ws.readyState !== this.WebSocketImpl.OPEN) return
    this.ws.send(JSON.stringify(command))
  }

  /** No-op unless status is "failed" — automatic retries own every other transition. */
  reconnect = (): void => {
    if (this.state.status !== "failed") return
    this.dispatch({ type: "MANUAL_RECONNECT" })
  }

  /** Tears the client down for good — not "unmount". This client outlives
   * component unmounts by design; call only when the session truly ends. */
  destroy = (): void => {
    this.destroyed = true
    this.clearTimer()
    this.listeners.clear()
    this.messageListeners.clear()
    this.teardownSocket()
  }

  private dispatch(action: SocketAction): void {
    if (this.destroyed) return
    const next = socketReducer(this.state, action)
    this.state = next
    this.notify()
    this.reactToState()
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private notifyMessage(raw: unknown): void {
    for (const listener of this.messageListeners) listener(raw)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private teardownSocket(): void {
    if (!this.ws) return
    this.ws.onopen = null
    this.ws.onmessage = null
    this.ws.onclose = null
    this.ws.close()
    this.ws = null
  }

  private connect(): void {
    if (this.destroyed) return

    const ws = new this.WebSocketImpl(this.url)
    this.ws = ws

    ws.onopen = () => this.dispatch({ type: "OPENED" })

    ws.onmessage = (event: MessageEvent) => {
      try {
        this.notifyMessage(JSON.parse(event.data))
      } catch {
        // Malformed frame — drop it rather than crash the socket.
      }
    }

    ws.onclose = () => {
      this.dispatch({
        type: "CLOSED",
        now: Date.now(),
        maxDisconnectedMs: this.maxDisconnectedMs,
      })
    }
  }

  private reactToState(): void {
    this.clearTimer()

    if (this.state.status === "connecting") {
      this.connect()
      return
    }

    if (this.state.status === "reconnecting") {
      const delay = backoffDelay(this.state.attempt - 1, this.retryConfig)
      this.timer = setTimeout(() => this.connect(), delay)
    }
  }
}
