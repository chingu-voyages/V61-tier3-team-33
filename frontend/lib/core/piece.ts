export type PieceType = number & { __brand: "PieceType" }

export const PAWN: PieceType = 0 as PieceType
export const KNIGHT: PieceType = 1 as PieceType
export const BISHOP: PieceType = 2 as PieceType
export const ROOK: PieceType = 3 as PieceType
export const QUEEN: PieceType = 4 as PieceType
export const KING: PieceType = 5 as PieceType

export type PieceColor = number & { __brand: "PieceColor" }

export const WHITE: PieceColor = 0 as PieceColor
export const BLACK: PieceColor = 1 as PieceColor

export interface Piece {
  type: PieceType
  color: PieceColor
}
