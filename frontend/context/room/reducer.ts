import type { PieceColor } from "@/core/piece"
import type { GameOutcome, GameSnapshot, Lifecycle } from "@/socket/types"
import { ACTIVE, FINISHED } from "@/socket/types"

export interface RoomState {
  roomId: string | null
  color: PieceColor | null
  status: Lifecycle | null
  result: GameOutcome | null
  pendingUndo: { by: PieceColor; expiresAt: number } | null
  /** True once we know whether the player has a room to resume (handshake with no roomId, or room:joined arrived). */
  initialized: boolean
}

export type RoomAction =
  | { type: "HANDSHAKE"; roomId: string | null }
  | {
      type: "ROOM_JOINED"
      roomId: string
      color: PieceColor
      status: Lifecycle
      state: GameSnapshot
    }
  | {
      type: "GAME_STARTED"
      roomId: string
    }
  | {
      type: "UNDO_APPLIED"
      roomId: string
      status: Lifecycle
    }
  | {
      type: "GAME_ENDED"
      roomId: string
      result: GameOutcome
    }
  | {
      type: "UNDO_REQUESTED"
      roomId: string
      by: PieceColor
      expiresAt: number
    }
  | { type: "UNDO_RESOLVED"; roomId: string }
  | { type: "UNDO_CANCELLED"; roomId: string }
  | { type: "UNDO_EXPIRED"; roomId: string }
  | { type: "UNDO_INVALIDATED"; roomId: string }
  | { type: "ROOM_LEFT"; roomId: string; color: PieceColor }
  | { type: "ROOM_RESET" }

/**
 * True when an incoming event is stale for the room we're currently in.
 *
 * When a player switches rooms mid-game (e.g. clicking "Play Online" while
 * already in a game), the old room's game:ended / room:left notifications
 * still land on the same socket, *after* the new room's room:joined has
 * already arrived. Without this guard those stale events would clobber the
 * freshly-joined room's state with the old game's outcome.
 */
function isStale(state: RoomState, roomId: string): boolean {
  return state.roomId !== null && roomId !== state.roomId
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  if (
    action.type !== "ROOM_JOINED" &&
    action.type !== "ROOM_RESET" &&
    action.type !== "HANDSHAKE" &&
    isStale(state, action.roomId)
  ) {
    return state
  }

  switch (action.type) {
    case "HANDSHAKE":
      // No room on this account — nothing to wait for, we're ready.
      // If a roomId is present we stay uninitialized until room:joined
      // fills in the full snapshot (color/status/result).
      return action.roomId === null ? { ...state, initialized: true } : state
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
        initialized: true,
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
        initialized: true,
      }
  }
}
