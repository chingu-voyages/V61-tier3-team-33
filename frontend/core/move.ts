import type { Brand } from "./brand"

export type MoveType = Brand<number, "MoveType">
export const MoveType = (value: number): MoveType => value as MoveType

export const NORMAL: MoveType = MoveType(0)
export const CASTLING: MoveType = MoveType(1)
export const EN_PASSANT: MoveType = MoveType(2)
export const PROMOTION: MoveType = MoveType(3)
