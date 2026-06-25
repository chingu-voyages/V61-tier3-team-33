import type { Brand } from "./brand";
import type { Piece, PieceColor } from "./piece";
import type { Position } from "./position";

import { WHITE, BLACK, PieceType } from "./piece";

/** A packed square byte (0 = empty, 1–6 = white PAWN…KING, 7–12 = black PAWN…KING). */
export type Square = Brand<number, "Square">;

export const Square = Object.assign(
  (value: number): Square => value as Square,
  {
    /** Packs a Piece into its Square encoding (1–12). */
    create(p: Piece): Square {
      return Square(p.color * 6 + p.type + 1);
    },

    /** Returns `true` if the square is empty. */
    isEmpty(square: Square): boolean {
      return square === EMPTY_SQUARE;
    },

    /** Returns `true` if the square holds any piece. */
    isOccupied(square: Square): boolean {
      return square !== EMPTY_SQUARE;
    },

    /** Returns `true` if the square holds a piece of the given color. */
    isOccupiedBy(square: Square, color: PieceColor): boolean {
      if (square === EMPTY_SQUARE) return false;
      return square <= WHITE_MAX ? color === WHITE : color === BLACK;
    },

    /** Returns `true` if the square holds a piece of the given color and one of the given types. */
    isOccupiedByAny(square: Square, color: PieceColor, ...types: PieceType[]): boolean {
      if (!Square.isOccupiedBy(square, color)) return false;
      return types.includes(Square.pieceType(square));
    },

    /** Returns `true` if the square is occupied by any piece of one of the given types (any color). */
    isOccupiedByAnyPiece(square: Square, ...types: PieceType[]): boolean {
      if (Square.isEmpty(square)) return false;
      return types.includes(Square.pieceType(square));
    },

    /** Extracts the piece type (0–5) from a square. Only meaningful when occupied. */
    pieceType(square: Square): PieceType {
      return PieceType((square - 1) % 6);
    },

    /** Extracts the piece color from a square. Only meaningful when occupied. */
    pieceColor(square: Square): PieceColor {
      return square <= WHITE_MAX ? WHITE : BLACK;
    },
  },
);

export const EMPTY_SQUARE: Square = Square(0);

const WHITE_MAX: Square = Square(6);

/** The 8x8 grid of squares, indexed by Position. */
export type Board = Brand<Uint8Array, "Board">;

export const Board = {
  /** Creates an empty board (all squares 0). */
  create(): Board {
    return new Uint8Array(64) as Board;
  },

  /** Returns an independent copy of the board. */
  copy(board: Board): Board {
    return new Uint8Array(board) as Board;
  },

  /** Places a square at `position`, overwriting whatever was there. */
  place(board: Board, position: Position, square: Square): void {
    board[position] = square;
  },

  /** Clears the square at `position`. */
  clear(board: Board, position: Position): void {
    board[position] = EMPTY_SQUARE;
  },

  /** Moves the piece at `from` to `to`, emptying `from`. */
  move(board: Board, from: Position, to: Position): void {
    board[to] = board[from]!;
    board[from] = EMPTY_SQUARE;
  },

  /** Returns the `Square` at `position`. */
  at(board: Board, position: Position): Square {
    return board[position] as Square;
  },

  /** Returns `true` if the square at `position` holds any piece. */
  isOccupiedAt(board: Board, position: Position): boolean {
    return board[position] !== EMPTY_SQUARE;
  },
};
