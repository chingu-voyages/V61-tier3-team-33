"use client"

import { useMemo } from "react"

import type { Position } from "@/core/position"
import { useSocketContext } from "./context"
import { Commands } from "./commands"
import { JoinInput, MoveInput } from "./types"

export interface GameActions {
  joinRoom: (input: JoinInput) => void
  leaveRoom: () => void
  makeMove: (input: MoveInput) => void
  requestUndo: () => void
  acceptUndo: () => void
  declineUndo: () => void
  resign: () => void
  syncState: () => void
  selectPosition: (position: Position) => void
  sendEmote: (emote: string) => void
}

/**
 * The ergonomic surface for driving a game over the socket — one method
 * per `Commands` builder, minus session:handshake/pong, which
 * SessionProvider owns. Callers never touch `send` directly.
 *
 * Memoized on `send`, which is stable for the client's lifetime, so it's
 * safe to destructure a single action out without extra memoization.
 */
export function useGameActions(): GameActions {
  const { send } = useSocketContext()

  return useMemo(
    () => ({
      joinRoom: (input: JoinInput) => send(Commands.joinRoom(input)),
      leaveRoom: () => send(Commands.leaveRoom()),
      makeMove: (input: MoveInput) => send(Commands.makeMove(input)),
      requestUndo: () => send(Commands.requestUndo()),
      acceptUndo: () => send(Commands.acceptUndo()),
      declineUndo: () => send(Commands.declineUndo()),
      resign: () => send(Commands.resign()),
      syncState: () => send(Commands.syncState()),
      selectPosition: (position: Position) =>
        send(Commands.selectPosition({ position })),
      sendEmote: (emote: string) => send(Commands.sendEmote(emote)),
    }),
    [send]
  )
}
