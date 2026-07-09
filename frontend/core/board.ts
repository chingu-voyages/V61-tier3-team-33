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

export type SquareState = Brand<number, "SquareState">

export const NONE: SquareState = 0 as SquareState
export const SELECTED: SquareState = 1 as SquareState
export const LAST_MOVE: SquareState = 2 as SquareState
export const LEGAL_MOVE: SquareState = 3 as SquareState
export const LEGAL_CAPTURE: SquareState = 4 as SquareState
export const CHECK: SquareState = 5 as SquareState
export const ILLEGAL: SquareState = 6 as SquareState
export const PREMOVE: SquareState = 7 as SquareState

export type VariantKey =
  | "none"
  | "selected"
  | "lastMove"
  | "legalMove"
  | "legalCapture"
  | "check"
  | "illegal"
  | "premove"

export interface StateConfig {
  selected: Position | null
  legalMoves: Position[]
  lastMove: { from: Position; to: Position } | null
}

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

    state(position: Position, config: StateConfig): SquareState {
      if (config.selected === position) return SELECTED
      if (config.legalMoves.includes(position)) return LEGAL_MOVE
      if (
        config.lastMove &&
        (config.lastMove.from === position || config.lastMove.to === position)
      )
        return LAST_MOVE
      return NONE
    },

    toVariant(state: SquareState): VariantKey {
      switch (state) {
        default:
        case NONE:
          return "none"
        case SELECTED:
          return "selected"
        case LAST_MOVE:
          return "lastMove"
        case LEGAL_MOVE:
          return "legalMove"
        case LEGAL_CAPTURE:
          return "legalCapture"
        case CHECK:
          return "check"
        case ILLEGAL:
          return "illegal"
        case PREMOVE:
          return "premove"
      }
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
