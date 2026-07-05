import { Brand } from "./brand"

export type PieceType = Brand<number, "PieceType">

export const PieceType = (value: number): PieceType => value as PieceType

export const PAWN: PieceType = PieceType(0)
export const KNIGHT: PieceType = PieceType(1)
export const BISHOP: PieceType = PieceType(2)
export const ROOK: PieceType = PieceType(3)
export const QUEEN: PieceType = PieceType(4)
export const KING: PieceType = PieceType(5)

export type PieceColor = Brand<number, "PieceColor">

export const PieceColor = Object.assign(
  (value: number): PieceColor => value as PieceColor,
  {
    opponent(color: PieceColor): PieceColor {
      return color === WHITE ? BLACK : WHITE
    },
  }
)

export const WHITE: PieceColor = PieceColor(0)
export const BLACK: PieceColor = PieceColor(1)

export interface Piece {
  type: PieceType
  color: PieceColor
}

export const Piece = {
  toChar(piece: Piece): string {
    const letters = ["P", "N", "B", "R", "Q", "K"]
    const c = letters[piece.type]!
    if (piece.color === BLACK) {
      return c.toLowerCase()
    }
    return c
  },

  parse(letter: string): Piece | null {
    if (letter.length !== 1) return null
    const upper = letter.toUpperCase()
    const type = "PNBRQK".indexOf(upper)
    if (type === -1) {
      return null
    }
    const color = letter === upper ? WHITE : BLACK
    return { type: PieceType(type), color }
  },
}
