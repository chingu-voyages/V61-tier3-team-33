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

// Bad token errors — clear token so retry sends fresh (tokenless) handshake.
const TOKEN_INVALID_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "not-authenticated",
  "invalid-payload",
])

// Only these mean the *session/connection* itself is broken and needs a
// handshake retry. Everything else (not-in-game, room-not-found, game-full,
// game-finished, ...) is a per-command error that the feature which sent
// the command already handles — treating it as fatal here caused a stray
// room:leave (e.g. from a stale UI) to spam an error toast and force a
// full reconnect/handshake cycle.
const SESSION_FATAL_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "not-authenticated",
  "invalid-payload",
  "internal-error",
])

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocketContext()
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [handshakeAttempt, setHandshakeAttempt] = useState(0)
  const inFlightRef = useRef(false)
  // Increments on each "open" so handshake re-sends on reconnect even if session is set.
  const connectionGenRef = useRef(0)

  useEffect(() => {
    if (socket.status === "open" && !inFlightRef.current) {
      // Send handshake on new connection gen; bump gen so same open stays silent.
      const gen = connectionGenRef.current
      connectionGenRef.current = gen + 1
      inFlightRef.current = true
      const savedToken = localStorage.getItem(STORAGE_KEY)
      socket.send(Commands.handshake(savedToken ?? undefined))
    }
    if (socket.status !== "open") {
      inFlightRef.current = false
    }
  }, [socket.status, socket, handshakeAttempt])

  useSocketEvent(SESSION_HANDSHAKE, (msg) => {
    inFlightRef.current = false
    localStorage.setItem(STORAGE_KEY, msg.token)
    setSession({ playerId: msg.playerId, token: msg.token })
  })

  useSocketEvent(SESSION_ERROR, (msg) => {
    if (!SESSION_FATAL_CODES.has(msg.code)) return

    inFlightRef.current = false

    if (TOKEN_INVALID_CODES.has(msg.code)) {
      localStorage.removeItem(STORAGE_KEY)
    }

    gooeyToast.error(msg.message || "Couldn't connect to the game server.", {
      description: "Retrying automatically…",
    })

    // Trigger retry so effect fires again.
    setHandshakeAttempt((n) => n + 1)
  })

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}
