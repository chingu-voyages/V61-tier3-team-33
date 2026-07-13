import type { PieceColor } from "@/core/piece"
import type { GameOutcome, GameSnapshot, Lifecycle } from "@/socket/types"
import { ACTIVE, FINISHED } from "@/socket/types"

export interface RoomState {
  roomId: string | null
  color: PieceColor | null
  status: Lifecycle | null
  result: GameOutcome | null
  pendingUndo: { by: PieceColor; expiresAt: number } | null
}

export type RoomAction =
  | {
      type: "ROOM_JOINED"
      roomId: string
      color: PieceColor
      status: Lifecycle
      state: GameSnapshot
    }
  | {
      type: "GAME_STARTED"
    }
  | {
      type: "UNDO_APPLIED"
      status: Lifecycle
    }
  | {
      type: "GAME_ENDED"
      result: GameOutcome
    }
  | {
      type: "UNDO_REQUESTED"
      by: PieceColor
      expiresAt: number
    }
  | { type: "UNDO_RESOLVED" }
  | { type: "UNDO_CANCELLED" }
  | { type: "UNDO_EXPIRED" }
  | { type: "UNDO_INVALIDATED" }
  | { type: "ROOM_LEFT"; color: PieceColor }
  | { type: "ROOM_RESET" }

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "ROOM_JOINED":
      return {
        ...state,
        roomId: action.roomId,
        color: action.color,
        status: action.status,
        result:
          action.status === FINISHED
            ? {
                status: action.state.resultStatus,
                winner: action.state.winner,
                hasWinner: action.state.hasWinner,
                drawReason: action.state.drawReason,
                reason: action.state.endReason,
              }
            : null,
      }
    case "GAME_STARTED":
      return {
        ...state,
        status: ACTIVE,
      }
    case "UNDO_APPLIED":
      return {
        ...state,
        status: action.status,
        pendingUndo: null,
      }
    case "GAME_ENDED":
      return {
        ...state,
        result: action.result,
        status: FINISHED,
        pendingUndo: null,
      }
    case "UNDO_REQUESTED":
      return {
        ...state,
        pendingUndo: { by: action.by, expiresAt: action.expiresAt },
      }
    case "UNDO_RESOLVED":
      return { ...state, pendingUndo: null }
    case "UNDO_CANCELLED":
      return { ...state, pendingUndo: null }
    case "UNDO_EXPIRED":
      return { ...state, pendingUndo: null }
    case "UNDO_INVALIDATED":
      return { ...state, pendingUndo: null }
    case "ROOM_LEFT":
      if (action.color !== state.color) return state
      return {
        ...state,
        roomId: null,
        color: null,
        status: null,
        result: null,
        pendingUndo: null,
      }
    case "ROOM_RESET":
      // Self-heal: server says we're not in a game (e.g. a stale leave
      // arrived after the room was already gone), but local state still
      // thinks we are. Drop it so a fresh /play mount doesn't resurrect
      // the old finished game.
      return {
        roomId: null,
        color: null,
        status: null,
        result: null,
        pendingUndo: null,
      }
  }
}
