import { RetryConfig } from "@/lib/retry"
import { getSocketClient } from "./client"
import { useMemo, useSyncExternalStore } from "react"
import { type SocketState } from "./reducer"
import { Socket, SocketContext } from "./context"

const noop = () => {}
const cbNoop = () => () => {}
// used as onMessage fallback; ignores type arg
const onMessageNoop = (_type: string, _handler: unknown) => () => {}

const serverState: SocketState = {
  status: "connecting",
  attempt: 0,
  disconnectedAt: null,
}

interface SocketProviderProps {
  url: string
  retryConfig?: RetryConfig
  maxDisconnectedMs?: number
  children: React.ReactNode
  socketCtor?: typeof WebSocket
}

export function SocketProvider({
  url,
  retryConfig,
  maxDisconnectedMs,
  socketCtor,
  children,
}: SocketProviderProps) {
  const client = useMemo(
    () => getSocketClient(url, { retryConfig, maxDisconnectedMs, socketCtor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url]
  )

  const state = useSyncExternalStore(
    client?.subscribe ?? cbNoop,
    (): SocketState => client?.snapshot() ?? serverState,
    (): SocketState => serverState
  )

  const socket = useMemo<Socket>(
    () => ({
      status: state.status,
      attempt: state.attempt,
      send: client?.send ?? noop,
      reconnect: client?.reconnect ?? noop,
      onMessage: client?.onMessage ?? onMessageNoop,
      onAnyMessage: client?.onAnyMessage ?? cbNoop,
      onAnySend: client?.onAnySend ?? cbNoop,
    }),
    [state.status, state.attempt, client]
  )

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  )
}
