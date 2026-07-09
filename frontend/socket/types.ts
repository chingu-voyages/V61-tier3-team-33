import type { Brand } from "@/core/brand"
import { Piece, PieceColor, PieceType } from "@/core/piece"
import { Position } from "@/core/position"
import { GameStatus, DrawReason } from "@/core/game"
import { MoveType } from "@/core/move"
import { SESSION_HANDSHAKE } from "./commands"

// Room lifecycle — WAITING (needs an opponent) / ACTIVE (in play) /
// FINISHED (game over). Distinct from GameStatus, which describes the
// chess position, not the room.
export type Lifecycle = 0 | 1 | 2
export const WAITING: Lifecycle = 0
export const ACTIVE: Lifecycle = 1
export const FINISHED: Lifecycle = 2

export type Mode = 0 | 1 | 2
export const HUMAN_VS_HUMAN: Mode = 0
export const HUMAN_VS_AI: Mode = 1
export const AI_VS_AI: Mode = 2

export type Difficulty = 0 | 1 | 2
export const EASY: Difficulty = 0
export const MEDIUM: Difficulty = 1
export const HARD: Difficulty = 2

export type EndReason = 0 | 1 | 2 | 3
export const RULES: EndReason = 0
export const TIMEOUT: EndReason = 1
export const RESIGNATION: EndReason = 2
export const ABANDONED: EndReason = 3

export type ClockFormat = Brand<string, "ClockFormat">

export function ClockFormat(value: string): ClockFormat {
  return value as ClockFormat
}

export interface JoinInput {
  roomId?: string
  mode: Mode
  color?: PieceColor
  difficulty?: Difficulty
  clock?: ClockFormat
}

export interface MoveInput {
  from: Position
  to: Position
  promoteTo?: PieceType
}

export interface SelectInput {
  position: Position
}

export interface Move {
  piece: Piece
  from: Position
  to: Position
  type: MoveType
  promoteTo: PieceType | null
  captured: Piece | null
  san?: string
}

// Nested outcome shape used by move:made / game:ended (not by
// GameSnapshot, which flattens these fields instead).
export interface GameOutcome {
  status: GameStatus
  winner: PieceColor
  hasWinner: boolean
  drawReason: DrawReason
  reason: EndReason
}

export interface ClockState {
  whiteMs: number
  blackMs: number
  active: PieceColor | null
}

// Full serializable game state — sent on room:joined, undo:applied, and
// state:sync. Flat by design, matching the backend's wire shape exactly.
export interface GameSnapshot {
  status: Lifecycle
  fen: string
  turn: PieceColor
  isCheck: boolean
  resultStatus: GameStatus
  winner: PieceColor
  hasWinner: boolean
  drawReason: DrawReason
  endReason: EndReason
  history: string[]
  capturedByWhite: PieceType[]
  capturedByBlack: PieceType[]
  clock: ClockState | null
}

export interface HandshakeReply {
  type: typeof SESSION_HANDSHAKE
  playerId: string
  token: string
}
