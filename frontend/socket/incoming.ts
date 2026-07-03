import type { PieceColor, PieceType } from "@/lib/core/piece"
import type { Position } from "@/lib/core/position"
import { SESSION_HANDSHAKE } from "./commands"

// Every shape the client can *receive* — the mirror of commands.ts
// (outgoing). No shared package yet, so keep both in sync by hand when
// the wire protocol changes.

export const SESSION_ERROR = "session:error" as const

export type ErrorCode =
  | "invalid-payload"
  | "not-implemented"
  | "not-authenticated"
  | "not-in-game"
  | "room-not-found"
  | "game-full"
  | "game-finished"
  | "internal-error"

/** What the server sends back on a successful session:handshake. */
export interface HandshakeReply {
  type: typeof SESSION_HANDSHAKE
  playerId: string
  token: string
}

export interface ErrorReply {
  type: typeof SESSION_ERROR
  code: ErrorCode
  message: string
}

// Excludes internal connection-lifecycle/clock-tick signals — those never
// reach a client.
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

export type MoveType = 0 | 1 | 2 | 3
export const NORMAL: MoveType = 0
export const CASTLING: MoveType = 1
export const EN_PASSANT: MoveType = 2
export const PROMOTION: MoveType = 3

export interface Move {
  piece: { type: PieceType; color: PieceColor }
  from: Position
  to: Position
  type: MoveType
  /** `null` when `type !== PROMOTION`. */
  promoteTo: PieceType | null
  /** `null` when this is not a capture. */
  captured: { type: PieceType; color: PieceColor } | null
  san?: string
}

/** Wire values for why a move was rejected. */
export type MoveError =
  "not-your-turn" | "illegal-move" | "game-over" | "square-empty"

/** Wire values for why a position:select was rejected. Its own union,
 * distinct from MoveError, even where reasons overlap in spirit —
 * selecting is a read-only query over any square, not an attempted move
 * over a from/to pair (e.g. "not-your-piece" has no MoveError analog). */
export type SelectError =
  | "not-your-turn"
  | "game-over"
  | "square-empty"
  | "not-your-piece"

export type GameStatus = 0 | 1 | 2
export const IN_PROGRESS: GameStatus = 0
export const CHECKMATE: GameStatus = 1
export const DRAW: GameStatus = 2

export type DrawReason = 0 | 1 | 2 | 3 | 4
export const NO_DRAW_REASON: DrawReason = 0
export const STALEMATE: DrawReason = 1
export const THREEFOLD_REPETITION: DrawReason = 2
export const FIFTY_MOVE_RULE: DrawReason = 3
export const INSUFFICIENT_MATERIAL: DrawReason = 4

export type EndReason = 0 | 1 | 2 | 3
export const RULES: EndReason = 0
export const TIMEOUT: EndReason = 1
export const RESIGNATION: EndReason = 2
export const ABANDONED: EndReason = 3

// Room lifecycle — WAITING (needs an opponent) / ACTIVE (in play) /
// FINISHED (game over). Distinct from GameStatus above, which describes
// the chess position, not the room. Mirrors backend domain/types.ts.
export type Lifecycle = 0 | 1 | 2
export const WAITING: Lifecycle = 0
export const ACTIVE: Lifecycle = 1
export const FINISHED: Lifecycle = 2

export interface GameOutcome {
  status: GameStatus
  winner: PieceColor
  hasWinner: boolean
  drawReason: DrawReason
  reason: EndReason
}

/**
 * Rebuilds the nested GameOutcome shape from a flat GameSnapshot's outcome
 * fields. Mirrors the backend's GameOutcome.fromSnapshot — one place that
 * knows the flat ↔ nested mapping so consumers (GameProvider) don't each
 * hand-roll it.
 */
export const GameOutcome = {
  fromSnapshot(snapshot: GameSnapshot): GameOutcome {
    return {
      status: snapshot.resultStatus,
      winner: snapshot.winner,
      hasWinner: snapshot.hasWinner,
      drawReason: snapshot.drawReason,
      reason: snapshot.endReason,
    }
  },
}

export interface ClockState {
  whiteMs: number
  blackMs: number
  active: PieceColor | null
}

/**
 * Full serializable game state — sent only on join, sync, and undo. Flat
 * by design, matching the backend 1:1 (was: nested `result: GameOutcome`,
 * and no `status` at all — use GameOutcome.fromSnapshot() to rebuild the
 * nested shape where needed).
 */
export interface GameSnapshot {
  status: Lifecycle
  fen: string
  isCheck: boolean
  resultStatus: GameStatus
  winner: PieceColor
  hasWinner: boolean
  drawReason: DrawReason
  endReason: EndReason
  history: string[]
  capturedByWhite: PieceType[]
  capturedByBlack: PieceType[]
}

export type Notification =
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

/**
 * Every message shape the client can receive. `useSocketEvent` narrows
 * against this union — add a variant above whenever the server sends a
 * new message type.
 */
export type Incoming = Notification | HandshakeReply | ErrorReply

/**
 * Runtime check that `raw` is a tagged object whose `type` matches `tag`.
 * Deliberately shallow — the server is trusted to send well-formed
 * messages, so once `type` matches, TypeScript narrows `raw` to the full
 * `Incoming` member for free.
 */
export function hasType<K extends Incoming["type"]>(
  raw: unknown,
  tag: K
): raw is Extract<Incoming, { type: K }> {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { type?: unknown }).type === tag
  )
}
