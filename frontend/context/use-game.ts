"use client"

import type { Board } from "@/lib/core/board"
import type { PieceColor } from "@/lib/core/piece"
import type { Position } from "@/lib/core/position"
import type { ClockState, GameOutcome, MoveError } from "@/socket/incoming"
import type { GameActions } from "@/socket/game-actions"
import { createContext, use } from "react"

export type GameState = {
  board: Board
  /** Null until room:joined arrives — no room joined yet. */
  roomId: string | null
  /** Null until room:joined arrives — this client's seat in the room. */
  color: PieceColor | null
  /** True once game:started has fired (both seats filled). Reset on
   * room:left. Deliberately independent of `clock`, which stays null
   * until clocks are actually implemented server-side. */
  started: boolean
  isCheck: boolean
  /** Null until room:joined arrives; non-null afterward even mid-game. */
  result: GameOutcome | null
  clock: ClockState | null
  /** Set while the opponent has an outstanding undo:request awaiting our
   * accept/decline; null otherwise. Respond with actions.acceptUndo() /
   * actions.declineUndo(). */
  pendingUndo: { by: PieceColor; expiresAt: number } | null
  /** Whose move it is. Null until a board exists (room:joined /
   * game:started). Derived from the FEN on every board-replacing event,
   * and updated optimistically on move:made (before the follow-up
   * state:sync lands) so the UI flips instantly. */
  turn: PieceColor | null
  /** The most recent move:rejected for this client, if any — e.g. to flash
   * an error on the square the player tried to move from. Cleared on the
   * next successful move or room:joined. */
  lastMoveRejection: { reason: MoveError; from: Position; to: Position } | null
}

export type GameAction =
  | {
      type: "ROOM_JOINED"
      roomId: string
      color: PieceColor
      board: Board
      isCheck: boolean
      result: GameOutcome
      turn: PieceColor | null
      /** Derived from the snapshot's room-lifecycle status (WAITING vs
       * ACTIVE/FINISHED) — lets a reload land straight on "game" instead
       * of waiting for a GAME_STARTED that will never re-fire for an
       * already-started room. */
      started: boolean
    }
  | { type: "GAME_STARTED"; board: Board; clock: ClockState | null; turn: PieceColor | null }
  | {
      type: "MOVE_RESULT"
      isCheck: boolean
      result: GameOutcome | null
      clock: ClockState | null
      turn: PieceColor | null
    }
  | {
      type: "UNDO_APPLIED"
      board: Board
      isCheck: boolean
      result: GameOutcome
      turn: PieceColor | null
    }
  | { type: "GAME_ENDED"; result: GameOutcome }
  | { type: "UNDO_REQUESTED"; by: PieceColor; expiresAt: number }
  | { type: "UNDO_RESOLVED" }
  | { type: "MOVE_REJECTED"; reason: MoveError; from: Position; to: Position }
  | { type: "ROOM_LEFT" }

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ROOM_JOINED":
      return {
        ...state,
        roomId: action.roomId,
        color: action.color,
        board: action.board,
        isCheck: action.isCheck,
        result: action.result,
        turn: action.turn,
        started: action.started,
        lastMoveRejection: null,
      }
    case "GAME_STARTED":
      return {
        ...state,
        board: action.board,
        clock: action.clock,
        turn: action.turn,
        started: true,
      }
    case "MOVE_RESULT":
      return {
        ...state,
        isCheck: action.isCheck,
        result: action.result,
        clock: action.clock,
        turn: action.turn,
        lastMoveRejection: null,
      }
    case "UNDO_APPLIED":
      return {
        ...state,
        board: action.board,
        isCheck: action.isCheck,
        result: action.result,
        turn: action.turn,
        pendingUndo: null,
      }
    case "GAME_ENDED":
      return { ...state, result: action.result, pendingUndo: null }
    case "UNDO_REQUESTED":
      return {
        ...state,
        pendingUndo: { by: action.by, expiresAt: action.expiresAt },
      }
    case "UNDO_RESOLVED":
      return { ...state, pendingUndo: null }
    case "MOVE_REJECTED":
      return {
        ...state,
        lastMoveRejection: {
          reason: action.reason,
          from: action.from,
          to: action.to,
        },
      }
    case "ROOM_LEFT":
      return { ...state, roomId: null, color: null, started: false, pendingUndo: null }
  }
}

type GameContextValue = {
  state: GameState
  /** The typed command layer for driving this game — join/move/undo/resign/
   * sync. See socket/game-actions.ts. */
  actions: GameActions
}

export const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const context = use(GameContext)
  if (context === null) {
    throw new Error("useGame must be used within a GameProvider")
  }
  return context
}
