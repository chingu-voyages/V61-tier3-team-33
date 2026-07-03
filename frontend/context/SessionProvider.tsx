"use client"

import { useEffect, useReducer, useRef } from "react"

import { useSocketContext } from "@/socket/socket-provider"
import { useSocketEvent } from "@/socket/use-socket-event"
import { Commands, SESSION_HANDSHAKE } from "@/socket/commands"
import { SESSION_ERROR } from "@/socket/incoming"
import { setStoredToken } from "@/socket/session-storage"
import { createInitialSessionState, sessionReducer } from "./session-reducer"
import { SessionContext } from "./use-session"

// Self-contained, like GameProvider: owns its reducer and subscribes to
// the socket itself via useSocketEvent. Must render inside SocketProvider.
//
// Also owns the handshake lifecycle:
//  - sends session:handshake (with any persisted token) every time the
//    socket becomes "open" — covers both the first connect and every
//    automatic reconnect, since each new connection needs its own
//    handshake to resume a session.
//  - persists whatever token comes back, so a page reload can resume the
//    same session instead of starting fresh. A stale/invalid token just
//    results in a fresh session, so there's no special retry path needed —
//    we always trust and store whatever the reply contains.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(
    sessionReducer,
    undefined,
    createInitialSessionState
  )
  const { status, send } = useSocketContext()
  const tokenRef = useRef(state.token)

  useSocketEvent(SESSION_HANDSHAKE, (reply) => {
    tokenRef.current = reply.token
    setStoredToken(reply.token)
    dispatch({
      type: "HANDSHAKE_OK",
      playerId: reply.playerId,
      token: reply.token,
    })
  })

  useSocketEvent(SESSION_ERROR, (reply) => {
    dispatch({
      type: "HANDSHAKE_ERROR",
      code: reply.code,
      message: reply.message,
    })
  })

  useEffect(() => {
    if (status !== "open") return
    dispatch({ type: "HANDSHAKE_SENT" })
    send(Commands.handshake(tokenRef.current ?? undefined))
  }, [status, send])

  return (
    <SessionContext.Provider value={{ state }}>
      {children}
    </SessionContext.Provider>
  )
}
