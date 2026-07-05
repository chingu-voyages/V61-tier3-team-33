import { Piece, PieceColor, PieceType } from "@/core/piece"
import { Position } from "@/core/position"
import { GameStatus, DrawReason } from "@/core/game"
import { MoveType } from "@/core/move"
import { SESSION_HANDSHAKE } from "./commands"

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

export interface Move {
  piece: Piece
  from: Position
  to: Position
  type: MoveType
  promoteTo: PieceType | null
  captured: Piece | null
  san?: string
}

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

export interface GameSnapshot {
  fen: string
  isCheck: boolean
  result: GameOutcome
  history: string[]
  capturedByWhite: PieceType[]
  capturedByBlack: PieceType[]
}

export interface HandshakeReply {
  type: typeof SESSION_HANDSHAKE
  playerId: string
  token: string
}
