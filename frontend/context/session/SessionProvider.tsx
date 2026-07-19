"use client"

import { useState } from "react"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { useSocketStatus } from "@/socket/use-status"
import { OPEN } from "@/socket/reducer"
import { Commands, SESSION_HANDSHAKE } from "@/socket/commands"
import {
  SESSION_ERROR,
  TOKEN_INVALID_CODES,
  SESSION_FATAL_CODES,
} from "@/socket/errors"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { SessionContext } from "./session-context"
import type { SessionInfo } from "./session-context"

const STORAGE_KEY = "chess_session_token"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocketContext()
  const [session, setSession] = useState<SessionInfo | null>(null)

  useSocketStatus(OPEN, () => {
    const savedToken = localStorage.getItem(STORAGE_KEY)
    socket.send(Commands.handshake(savedToken ?? undefined))
  })

  useSocketEvent(SESSION_HANDSHAKE, (msg) => {
    localStorage.setItem(STORAGE_KEY, msg.token)
    setSession({ playerId: msg.playerId, token: msg.token })
  })

  useSocketEvent(SESSION_ERROR, (msg) => {
    if (!SESSION_FATAL_CODES.has(msg.code)) return

    if (TOKEN_INVALID_CODES.has(msg.code)) {
      localStorage.removeItem(STORAGE_KEY)
    }

    gooeyToast.error(msg.message || "Couldn't connect to the game server.", {
      description: "Retrying automatically…",
    })

    const savedToken = localStorage.getItem(STORAGE_KEY)
    socket.send(Commands.handshake(savedToken ?? undefined))
  })

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}
