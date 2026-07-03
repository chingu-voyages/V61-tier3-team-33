import type { Position } from "@/lib/core/position"
import type { PieceColor, PieceType } from "@/lib/core/piece"

// Defined here, not incoming.ts, since it's the client-sent tag —
// incoming.ts imports it back to type the server's reply.
export const SESSION_HANDSHAKE = "session:handshake" as const
export const SESSION_PONG = "session:pong" as const
export const ROOM_JOIN = "room:join" as const
export const ROOM_LEAVE = "room:leave" as const
export const MOVE_MAKE = "move:make" as const
export const UNDO_REQUEST = "undo:request" as const
export const UNDO_ACCEPT = "undo:accept" as const
export const UNDO_DECLINE = "undo:decline" as const
export const GAME_RESIGN = "game:resign" as const
export const STATE_SYNC = "state:sync" as const

// The click-a-piece step before move:make — answered with position:accept
// (legal destinations) or position:reject.
export const POSITION_SELECT = "position:select" as const

export type Mode = 0 | 1 | 2
export const HUMAN_VS_HUMAN: Mode = 0
export const HUMAN_VS_AI: Mode = 1
export const AI_VS_AI: Mode = 2

export type Difficulty = 0 | 1 | 2
export const EASY: Difficulty = 0
export const MEDIUM: Difficulty = 1
export const HARD: Difficulty = 2

export interface JoinInput {
  roomId?: string
  mode: Mode
  color?: PieceColor
  difficulty?: Difficulty
}

export interface MoveInput {
  from: Position
  to: Position
  promoteTo?: PieceType
}

export interface SelectInput {
  position: Position
}

export type Command =
  | { type: typeof SESSION_HANDSHAKE; token?: string }
  | { type: typeof SESSION_PONG }
  | ({ type: typeof ROOM_JOIN } & JoinInput)
  | { type: typeof ROOM_LEAVE }
  | ({ type: typeof MOVE_MAKE } & MoveInput)
  | { type: typeof UNDO_REQUEST }
  | { type: typeof UNDO_ACCEPT }
  | { type: typeof UNDO_DECLINE }
  | { type: typeof GAME_RESIGN }
  | { type: typeof STATE_SYNC }
  | ({ type: typeof POSITION_SELECT } & SelectInput)

// Typed builders so callers never hand-assemble a `{ type, ... }` literal —
// a missing or misspelled field is now a compile error.
export const Commands = {
  handshake(token?: string): Command {
    return token
      ? { type: SESSION_HANDSHAKE, token }
      : { type: SESSION_HANDSHAKE }
  },
  pong(): Command {
    return { type: SESSION_PONG }
  },
  joinRoom(input: JoinInput): Command {
    return { type: ROOM_JOIN, ...input }
  },
  leaveRoom(): Command {
    return { type: ROOM_LEAVE }
  },
  makeMove(input: MoveInput): Command {
    return { type: MOVE_MAKE, ...input }
  },
  requestUndo(): Command {
    return { type: UNDO_REQUEST }
  },
  acceptUndo(): Command {
    return { type: UNDO_ACCEPT }
  },
  declineUndo(): Command {
    return { type: UNDO_DECLINE }
  },
  resign(): Command {
    return { type: GAME_RESIGN }
  },
  syncState(): Command {
    return { type: STATE_SYNC }
  },
  selectPosition(input: SelectInput): Command {
    return { type: POSITION_SELECT, ...input }
  },
}
