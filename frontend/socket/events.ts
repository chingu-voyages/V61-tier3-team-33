import type { PieceColor } from "@/core/piece"
import type { Position } from "@/core/position"
import { type ErrorReply, type MoveError, type SelectError } from "./errors"
import type {
  ClockState,
  GameOutcome,
  GameSnapshot,
  HandshakeReply,
  Move,
} from "./types"

export const ANY = "*" as const

export const ROOM_JOINED = "room:joined" as const
export const GAME_STARTED = "game:started" as const
export const ROOM_LEFT = "room:left" as const
export const GAME_ENDED = "game:ended" as const

export const MOVE_MADE = "move:made" as const
export const MOVE_REJECTED = "move:rejected" as const

export const UNDO_REQUESTED = "undo:requested" as const
export const UNDO_APPLIED = "undo:applied" as const
export const UNDO_DECLINED = "undo:declined" as const

export const POSITION_ACCEPTED = "position:accept" as const
export const POSITION_REJECTED = "position:reject" as const

export const CLOCK_STARTED = "clock:started" as const
export const CLOCK_PAUSED = "clock:paused" as const
export const CLOCK_EXPIRED = "clock:expired" as const

export const GRACE_STARTED = "grace:started" as const
export const GRACE_CANCELLED = "grace:cancelled" as const
export const GRACE_EXPIRED = "grace:expired" as const

export const EMOTE_RECEIVED = "emote:received" as const

export type GameEvent =
  | {
      type: typeof ROOM_JOINED
      roomId: string
      color: PieceColor
      state: GameSnapshot
    }
  | {
      type: typeof GAME_STARTED
      roomId: string
      fen: string
      turn: PieceColor
      clock: ClockState | null
    }
  | {
      type: typeof ROOM_LEFT
      roomId: string
      color: PieceColor
    }
  | {
      type: typeof GAME_ENDED
      roomId: string
      result: GameOutcome
      winner: PieceColor | null
    }
  | {
      type: typeof MOVE_MADE
      roomId: string
      by: PieceColor
      move: Move
      isCheck: boolean
      isGameOver: boolean
      turn: PieceColor
      result: GameOutcome | null
      clock: ClockState | null
    }
  | {
      type: typeof MOVE_REJECTED
      roomId: string
      by: PieceColor
      reason: MoveError
      from: Position
      to: Position
    }
  | {
      type: typeof UNDO_REQUESTED
      roomId: string
      by: PieceColor
      expiresAt: number
    }
  | {
      type: typeof UNDO_APPLIED
      roomId: string
      state: GameSnapshot
      clock: ClockState | null
    }
  | {
      type: typeof UNDO_DECLINED
      roomId: string
      by: PieceColor
    }
  | {
      type: typeof POSITION_ACCEPTED
      roomId: string
      position: Position
      moves: Position[]
    }
  | {
      type: typeof POSITION_REJECTED
      roomId: string
      position: Position
      reason: SelectError
    }
  | {
      type: typeof CLOCK_STARTED
      roomId: string
      color: PieceColor
      remainingMs: number
    }
  | {
      type: typeof CLOCK_PAUSED
      roomId: string
      color: PieceColor
      remainingMs: number
    }
  | {
      type: typeof CLOCK_EXPIRED
      roomId: string
      color: PieceColor
    }
  | {
      type: typeof GRACE_STARTED
      roomId: string
      color: PieceColor
      deadlineMs: number
    }
  | {
      type: typeof GRACE_CANCELLED
      roomId: string
      color: PieceColor
    }
  | {
      type: typeof GRACE_EXPIRED
      roomId: string
      color: PieceColor
    }
  | {
      type: typeof EMOTE_RECEIVED
      roomId: string
      from: PieceColor
      emote: string
    }

/** Every message shape the client can receive. Add a variant above for new server messages. */
export type ServerEvent = GameEvent | HandshakeReply | ErrorReply

/** Runtime check that `raw.type` matches `tag`. Shallow — server is trusted. */
export function hasType<K extends ServerEvent["type"]>(
  raw: unknown,
  tag: K
): raw is Extract<ServerEvent, { type: K }> {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { type?: unknown }).type === tag
  )
}
