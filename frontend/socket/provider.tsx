import { RetryConfig } from "@/lib/retry"
import { getSocketClient } from "./client"
import { useMemo, useSyncExternalStore } from "react"
import { SocketStatus } from "./reducer"
import { Socket, SocketContext } from "./context"

const noop = () => {}
const cbNoop = () => () => {}
// used as onMessage fallback; ignores type arg
const onMessageNoop = (_type: string, _handler: unknown) => () => {}

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

  const status = useSyncExternalStore(
    client?.subscribe ?? cbNoop,
    (): SocketStatus => client?.snapshot() ?? "connecting",
    (): SocketStatus => "connecting"
  )

  const socket = useMemo<Socket>(
    () => ({
      status,
      send: client?.send ?? noop,
      reconnect: client?.reconnect ?? noop,
      onMessage: client?.onMessage ?? onMessageNoop,
    }),
    [status, client]
  )

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  )
}
