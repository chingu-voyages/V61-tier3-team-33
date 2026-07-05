import type { Brand } from "./brand"

export type GameStatus = Brand<number, "GameStatus">
export const GameStatus = (value: number): GameStatus => value as GameStatus

export const IN_PROGRESS: GameStatus = GameStatus(0)
export const CHECKMATE: GameStatus = GameStatus(1)
export const DRAW: GameStatus = GameStatus(2)

export type DrawReason = Brand<number, "DrawReason">
export const DrawReason = (value: number): DrawReason => value as DrawReason

export const NO_DRAW_REASON: DrawReason = DrawReason(0)
export const STALEMATE: DrawReason = DrawReason(1)
export const THREEFOLD_REPETITION: DrawReason = DrawReason(2)
export const FIFTY_MOVE_RULE: DrawReason = DrawReason(3)
export const INSUFFICIENT_MATERIAL: DrawReason = DrawReason(4)
