"use client"

import { useEffect, useRef, useState } from "react"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { Commands, SESSION_HANDSHAKE } from "@/socket/commands"
import { SESSION_ERROR, type ErrorCode } from "@/socket/errors"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { SessionContext } from "./session-context"
import type { SessionInfo } from "./session-context"

const STORAGE_KEY = "chess_session_token"

// Errors that mean the saved token itself is bad — clear it so the retry
// goes out as a fresh (tokenless) handshake instead of repeating forever.
// Typed against ErrorCode (from socket/errors.ts) so a typo or a renamed
// code is a compile error instead of a silently-dead check.
const TOKEN_INVALID_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "not-authenticated",
  "invalid-payload",
])

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocketContext()
  const [session, setSession] = useState<SessionInfo | null>(null)
  // Bumped to force the handshake effect to re-run after a failed attempt —
  // `session` alone can't do this since it stays null across retries.
  const [handshakeAttempt, setHandshakeAttempt] = useState(0)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (socket.status === "open" && !session && !inFlightRef.current) {
      inFlightRef.current = true
      const savedToken = localStorage.getItem(STORAGE_KEY)
      socket.send(Commands.handshake(savedToken ?? undefined))
    }
    // Reset so a fresh connection (new socket.status "open" transition)
    // is allowed to send its own handshake.
    if (socket.status !== "open") {
      inFlightRef.current = false
    }
  }, [socket.status, socket, session, handshakeAttempt])

  useSocketEvent(SESSION_HANDSHAKE, (msg) => {
    inFlightRef.current = false
    localStorage.setItem(STORAGE_KEY, msg.token)
    setSession({ playerId: msg.playerId, token: msg.token })
  })

  useSocketEvent(SESSION_ERROR, (msg) => {
    inFlightRef.current = false

    if (TOKEN_INVALID_CODES.has(msg.code)) {
      localStorage.removeItem(STORAGE_KEY)
    }

    gooeyToast.error(msg.message || "Couldn't connect to the game server.", {
      description: "Retrying automatically…",
    })

    // Trigger a retry on the next tick so the effect above fires again.
    setHandshakeAttempt((n) => n + 1)
  })

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
