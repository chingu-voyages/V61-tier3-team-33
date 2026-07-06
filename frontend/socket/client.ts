import { backoffDelay, RetryConfig } from "@/lib/retry"
import {
  initialSocketState,
  reducer,
  SocketAction,
  SocketState,
  SocketStatus,
} from "./reducer"

export const DEFAULT_DISCONNECTION = 110 * 1000

type StatusListener = () => void
type Unsubscribe = () => void
type MessageListener = (raw: unknown) => void

export interface SocketClientOptions {
  retryConfig?: RetryConfig
  maxDisconnectedMs?: number
  socketCtor?: typeof WebSocket // Injected so tests can supply a fake WebSocket.
}

export default class SocketClient {
  // Flag indicating whether the socket is destroyed.
  private destroyed = false

  // state of the current socket
  private state: SocketState = initialSocketState

  // Notified on status transitions (connecting/open/reconnecting/closed/failed)
  private statusListener: Set<StatusListener> = new Set()

  // Notified on every inbound message, keyed by message type — for feature code.
  private messageListeners: Map<string, Set<MessageListener>> = new Map()

  // Notified on every inbound message, regardless of type — for debug tooling.
  private observers: Set<MessageListener> = new Set()

  // Notified on every outbound send — for debug tooling.
  private outObservers: Set<MessageListener> = new Set()

  // Constructor for creating sockets — real WebSocket, or a fake for tests.
  private readonly SocketCtor: typeof WebSocket

  // The live socket instance, once connected.
  private socket: InstanceType<typeof WebSocket> | null = null

  // Timer for retrying connection after disconnection.
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  // config for retry policy
  private readonly retryConfig?: RetryConfig

  // maximum time to wait before reconnecting
  private readonly maxDisconnectedMs: number

  constructor(
    public readonly url: string,
    options: SocketClientOptions = {}
  ) {
    this.retryConfig = options.retryConfig
    this.maxDisconnectedMs = options.maxDisconnectedMs ?? DEFAULT_DISCONNECTION
    this.SocketCtor = options.socketCtor ?? WebSocket
    this.connect()
  }

  snapshot = (): SocketStatus => {
    return this.state.status
  }

  subscribe = (callback: StatusListener): Unsubscribe => {
    this.statusListener.add(callback)
    return () => this.statusListener.delete(callback)
  }

  onMessage = (type: string, handler: MessageListener): Unsubscribe => {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, new Set())
    }
    this.messageListeners.get(type)!.add(handler)
    return () => this.messageListeners.get(type)?.delete(handler)
  }

  onAnyMessage = (handler: MessageListener): Unsubscribe => {
    this.observers.add(handler)
    return () => this.observers.delete(handler)
  }

  onAnySend = (handler: MessageListener): Unsubscribe => {
    this.outObservers.add(handler)
    return () => this.outObservers.delete(handler)
  }

  send = (command: object): void => {
    if (!this.socket || this.socket.readyState !== this.SocketCtor.OPEN) return
    this.socket.send(JSON.stringify(command))
    for (const observer of this.outObservers) observer(command)
  }

  reconnect = (): void => {
    if (this.state.status !== "failed") return
    this.dispatch({ type: "MANUAL_RECONNECT" })
  }

  destroy = (): void => {
    this.destroyed = true
    this.clearTimer()
    this.statusListener.clear()
    this.messageListeners.clear()
    this.observers.clear()
    this.outObservers.clear()
    this.teardownSocket()
  }

  private dispatch(action: SocketAction) {
    if (this.destroyed) return
    const nextState = reducer(this.state, action)
    this.state = nextState
    this.notifyStatus()
    this.react()
  }

  private notifyStatus() {
    for (const listener of this.statusListener) {
      listener()
    }
  }

  private notifyMessage(raw: unknown) {
    for (const observer of this.observers) {
      observer(raw)
    }
    const type = (raw as { type?: string } | null)?.type
    if (!type) return
    for (const listener of this.messageListeners.get(type) ?? []) {
      listener(raw)
    }
  }

  private react() {
    this.clearTimer()

    if (this.state.status === "connecting") {
      this.connect()
      return
    }

    if (this.state.status === "reconnecting") {
      const delay = backoffDelay(this.state.attempt - 1, this.retryConfig)
      this.retryTimer = setTimeout(() => this.connect(), delay)
      return
    }
  }

  private teardownSocket(): void {
    if (!this.socket) return
    this.socket.onopen = null
    this.socket.onmessage = null
    this.socket.onclose = null
    this.socket.close()
    this.socket = null
  }

  private connect(): void {
    if (this.destroyed) return

    this.socket = new this.SocketCtor(this.url)

    this.socket.onopen = () => this.dispatch({ type: "OPENED" })

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        this.notifyMessage(JSON.parse(event.data))
      } catch {}
    }

    this.socket.onclose = () =>
      this.dispatch({
        type: "CLOSED",
        now: Date.now(),
        maxDisconnectedMs: this.maxDisconnectedMs,
      })
  }

  private clearTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }
}

declare global {
  var _chessSocketClient: SocketClient | undefined
}

export function resetSocketClient(): void {
  globalThis._chessSocketClient?.destroy()
  globalThis._chessSocketClient = undefined
}

// retryConfig/maxDisconnectedMs only apply on first creation for a given url;
// changing them on a live client requires resetSocketClient() first.
export function getSocketClient(
  url: string,
  options: SocketClientOptions
): SocketClient | null {
  if (typeof window === "undefined") return null

  if (
    globalThis._chessSocketClient &&
    globalThis._chessSocketClient.url !== url
  ) {
    resetSocketClient()
  }

  if (!globalThis._chessSocketClient) {
    globalThis._chessSocketClient = new SocketClient(url, options)
  }

  return globalThis._chessSocketClient
}
