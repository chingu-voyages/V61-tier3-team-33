"use client"

import { createContext, use, useSyncExternalStore } from "react"

import type { RetryConfig } from "@/lib/retry"
import type { SocketStatus } from "./socket-reducer"
import { SocketClient, type SocketClientOptions } from "./socket-client"

export interface Socket {
  status: SocketStatus
  send: (command: object) => void
  reconnect: () => void
  /** Subscribe to every inbound message; filter by `raw.type` in your own
   * handler. Returns an unsubscribe function. */
  onMessage: (handler: (raw: unknown) => void) => () => void
}

export const SocketContext = createContext<Socket | null>(null)

export function useSocketContext(): Socket {
  const context = use(SocketContext)
  if (context === null) {
    throw new Error("useSocketContext must be used within a SocketProvider")
  }
  return context
}

// One connection for the whole tab session. Guarded on globalThis so a
// dev-mode hot reload re-evaluating this module doesn't spin up a second
// socket.
declare global {
  var __chessSocketClient: SocketClient | undefined
}

function getSocketClient(
  url: string,
  options: SocketClientOptions
): SocketClient | null {
  if (typeof window === "undefined") return null // SSR: no socket server-side

  if (!globalThis.__chessSocketClient) {
    globalThis.__chessSocketClient = new SocketClient(url, options)
  }
  return globalThis.__chessSocketClient
}

const noopSubscribe = () => () => {}
const noopSend = () => {}
const noopReconnect = () => {}
const noopOnMessage = () => () => {}

interface SocketProviderProps {
  url: string
  retryConfig?: RetryConfig
  maxDisconnectedMs?: number
  children: React.ReactNode
}

// Creates (or attaches to) the tab's one SocketClient and exposes it
// through context. Message delivery is fan-out at the client level, so
// any descendant can subscribe independently via
// useSocketContext().onMessage(handler).
export function SocketProvider({
  url,
  retryConfig,
  maxDisconnectedMs,
  children,
}: SocketProviderProps) {
  const client = getSocketClient(url, { retryConfig, maxDisconnectedMs })

  const status = useSyncExternalStore(
    client?.subscribe ?? noopSubscribe,
    (): SocketStatus => client?.getSnapshot() ?? "connecting",
    (): SocketStatus => "connecting" // server snapshot — matches pre-hydration client read
  )

  const socket: Socket = {
    status,
    send: client?.send ?? noopSend,
    reconnect: client?.reconnect ?? noopReconnect,
    onMessage: client?.onMessage ?? noopOnMessage,
  }

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  )
}
