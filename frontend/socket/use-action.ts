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
  cancelUndo: () => void
  resign: () => void
  syncState: () => void
  selectPosition: (position: Position) => void
  sendEmote: (emote: string) => void
}

/** Game actions over socket — one method per Commands builder (session:handshake/pong owned by SessionProvider). Memoized on `send`. */
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
      cancelUndo: () => send(Commands.cancelUndo()),
      resign: () => send(Commands.resign()),
      syncState: () => send(Commands.syncState()),
      selectPosition: (position: Position) =>
        send(Commands.selectPosition({ position })),
      sendEmote: (emote: string) => send(Commands.sendEmote(emote)),
    }),
    [send]
  )
}
