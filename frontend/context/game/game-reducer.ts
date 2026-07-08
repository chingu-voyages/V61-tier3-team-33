import type { Board } from "@/core/board"
import type { PieceColor } from "@/core/piece"
import { WHITE } from "@/core/piece"
import type { Position } from "@/core/position"
import type { ClockState, GameOutcome, Lifecycle } from "@/socket/types"
import { ACTIVE, FINISHED } from "@/socket/types"
import type { MoveError } from "@/socket/errors"

export interface GameState {
  board: Board
  roomId: string | null
  color: PieceColor | null
  status: Lifecycle | null
  isCheck: boolean
  result: GameOutcome | null
  clock: ClockState | null
  clockReceivedAt: number | null
  pendingUndo: { by: PieceColor; expiresAt: number } | null
  turn: PieceColor | null
  lastMoveRejection: { reason: MoveError; from: Position; to: Position } | null
}

export type GameAction =
  | {
      type: "ROOM_JOINED"
      roomId: string
      color: PieceColor
      board: Board
      status: Lifecycle
      isCheck: boolean
      turn: PieceColor | null
      clock: ClockState | null
      clockReceivedAt: number | null
    }
  | {
      type: "GAME_STARTED"
      board: Board
      clock: ClockState | null
      clockReceivedAt: number | null
      turn: PieceColor | null
    }
  | {
      type: "MOVE_RESULT"
      isCheck: boolean
      result: GameOutcome | null
      clock: ClockState | null
      clockReceivedAt: number | null
      turn: PieceColor | null
    }
  | {
      type: "UNDO_APPLIED"
      board: Board
      status: Lifecycle
      isCheck: boolean
      turn: PieceColor | null
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
  | {
      type: "MOVE_REJECTED"
      reason: MoveError
      from: Position
      to: Position
    }
  | { type: "ROOM_LEFT" }
  | { type: "CLOCK_TICK" }

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ROOM_JOINED":
      return {
        ...state,
        roomId: action.roomId,
        color: action.color,
        board: action.board,
        status: action.status,
        isCheck: action.isCheck,
        turn: action.turn,
        clock: action.clock,
        clockReceivedAt: action.clockReceivedAt,
        lastMoveRejection: null,
      }
    case "GAME_STARTED":
      return {
        ...state,
        board: action.board,
        clock: action.clock,
        clockReceivedAt: action.clockReceivedAt,
        turn: action.turn,
        status: ACTIVE,
      }
    case "MOVE_RESULT":
      return {
        ...state,
        isCheck: action.isCheck,
        result: action.result,
        clock: action.clock,
        clockReceivedAt: action.clockReceivedAt,
        turn: action.turn,
        lastMoveRejection: null,
      }
    case "UNDO_APPLIED":
      return {
        ...state,
        board: action.board,
        status: action.status,
        isCheck: action.isCheck,
        turn: action.turn,
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
      return {
        ...state,
        roomId: null,
        color: null,
        status: null,
        pendingUndo: null,
      }
    case "CLOCK_TICK": {
      if (!state.clock || state.clock.active === null || state.clockReceivedAt === null) return state
      const elapsed = performance.now() - state.clockReceivedAt
      if (state.clock.active === WHITE) {
        return {
          ...state,
          clock: { ...state.clock, whiteMs: Math.max(0, state.clock.whiteMs - elapsed) },
          clockReceivedAt: performance.now(),
        }
      }
      return {
        ...state,
        clock: { ...state.clock, blackMs: Math.max(0, state.clock.blackMs - elapsed) },
        clockReceivedAt: performance.now(),
      }
    }
  }
}
