import { createContext, use } from "react"
import { SocketStatus } from "./reducer"

type Handler = (raw: unknown) => void
type Unsubscribe = () => void

export interface Socket {
  status: SocketStatus
  send: (command: object) => void
  reconnect: () => void
  onMessage: (type: string, handler: Handler) => Unsubscribe
  onAnyMessage: (handler: Handler) => Unsubscribe
}

export const SocketContext = createContext<Socket | null>(null)

export function useSocketContext(): Socket {
  const context = use(SocketContext)
  if (context === null) {
    throw new Error("useSocketContext must be used within a SocketProvider")
  }
  return context
}
