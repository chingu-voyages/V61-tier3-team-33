"use client"

import { useEffect, useState } from "react"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { Commands, SESSION_HANDSHAKE } from "@/socket/commands"
import { SessionContext } from "./session-context"
import type { SessionInfo } from "./session-context"

const STORAGE_KEY = "chess_session_token"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocketContext()
  const [session, setSession] = useState<SessionInfo | null>(null)

  useEffect(() => {
    if (socket.status === "open" && !session) {
      const savedToken = localStorage.getItem(STORAGE_KEY)
      socket.send(Commands.handshake(savedToken ?? undefined))
    }
  }, [socket.status, socket, session])

  useSocketEvent(SESSION_HANDSHAKE, (msg) => {
    localStorage.setItem(STORAGE_KEY, msg.token)
    setSession({ playerId: msg.playerId, token: msg.token })
  })

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
