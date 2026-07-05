import { Brand } from "./brand"
import { File, Position, Rank } from "./position"
import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  PAWN,
  Piece,
  PieceColor,
  PieceType,
  QUEEN,
  ROOK,
  WHITE,
} from "./piece"

export type Square = Brand<number, "Square">

export const Square = Object.assign(
  (value: number): Square => value as Square,
  {
    create(p: Piece): Square {
      return Square(p.color * 6 + p.type + 1)
    },

    decode(value: number): Piece | null {
      if (value === 0) return null
      const color = value > 6 ? BLACK : WHITE
      const pieceTypes = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING]
      const type = pieceTypes[(value - 1) % 6]
      return { color, type }
    },

    pieceType(square: Square): PieceType {
      return PieceType((square - 1) % 6)
    },

    pieceColor(square: Square): PieceColor {
      return square <= WHITE_MAX ? WHITE : BLACK
    },

    isEmpty(square: Square): boolean {
      return square === EMPTY_SQUARE
    },

    isOccupied(square: Square): boolean {
      return square !== EMPTY_SQUARE
    },
  }
)

export const EMPTY_SQUARE: Square = Square(0)

const WHITE_MAX: Square = Square(6)

export type Board = Brand<Uint8Array, "Board">

export const Board = {
  create(): Board {
    return new Uint8Array(64) as Board
  },

  place(board: Board, position: Position, square: Square): void {
    board[position] = square
  },

  at(board: Board, position: Position): Square {
    return board[position] as Square
  },

  *squares(
    board: Board,
  ): Generator<{ value: number; position: Position }, void, void> {
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const pos = Position.create(File(f), Rank(r))
        yield { value: board[pos]!, position: pos }
      }
    }
  },
}
