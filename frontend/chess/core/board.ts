import type { Brand } from "./brand";
import type { Piece, PieceColor } from "./piece";
import { Position, File, Rank } from "./position";
import { WHITE, BLACK, PieceType, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from "./piece";

export type SquareState = Brand<number, "SquareState">;

export const NONE: SquareState = 0 as SquareState;
export const SELECTED: SquareState = 1 as SquareState;
export const LAST_MOVE: SquareState = 2 as SquareState;
export const LEGAL_MOVE: SquareState = 3 as SquareState;
export const LEGAL_CAPTURE: SquareState = 4 as SquareState;
export const CHECK: SquareState = 5 as SquareState;
export const ILLEGAL: SquareState = 6 as SquareState;
export const PREMOVE: SquareState = 7 as SquareState;

export type VariantKey =
  | "none"
  | "selected"
  | "lastMove"
  | "legalMove"
  | "legalCapture"
  | "check"
  | "illegal"
  | "premove";

export interface StateConfig {
  selected: Position | null;
  legalMoves: Position[];
  lastMove: { from: Position; to: Position } | null;
}

/** A packed square byte (0 = empty, 1–6 = white PAWN…KING, 7–12 = black PAWN…KING). */
export type Square = Brand<number, "Square">;

export const Square = Object.assign(
  (value: number): Square => value as Square,
  {
    create(p: Piece): Square {
      return Square(p.color * 6 + p.type + 1);
    },

    decode(value: number): Piece | null {
      if (value === 0) return null;
      const color = value > 6 ? BLACK : WHITE;
      const pieceTypes = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING];
      const type = pieceTypes[(value - 1) % 6]!;
      return { color, type };
    },

    isEmpty(square: Square): boolean {
      return square === EMPTY_SQUARE;
    },

    isOccupied(square: Square): boolean {
      return square !== EMPTY_SQUARE;
    },

    isOccupiedBy(square: Square, color: PieceColor): boolean {
      if (square === EMPTY_SQUARE) return false;
      return square <= WHITE_MAX ? color === WHITE : color === BLACK;
    },

    isOccupiedByAny(square: Square, color: PieceColor, ...types: PieceType[]): boolean {
      if (!Square.isOccupiedBy(square, color)) return false;
      return types.includes(Square.pieceType(square));
    },

    isOccupiedByAnyPiece(square: Square, ...types: PieceType[]): boolean {
      if (Square.isEmpty(square)) return false;
      return types.includes(Square.pieceType(square));
    },

    pieceType(square: Square): PieceType {
      return PieceType((square - 1) % 6);
    },

    pieceColor(square: Square): PieceColor {
      return square <= WHITE_MAX ? WHITE : BLACK;
    },

    state(position: Position, board: Board, config: StateConfig): SquareState {
      if (config.selected === position) return SELECTED;
      if (config.legalMoves.includes(position)) {
        if (Board.isOccupiedAt(board, position)) return LEGAL_CAPTURE;
        return LEGAL_MOVE;
      }
      if (config.lastMove && (config.lastMove.from === position || config.lastMove.to === position)) return LAST_MOVE;
      return NONE;
    },

    toVariant(state: SquareState): VariantKey {
      switch (state) {
        default:
        case NONE: return "none";
        case SELECTED: return "selected";
        case LAST_MOVE: return "lastMove";
        case LEGAL_MOVE: return "legalMove";
        case LEGAL_CAPTURE: return "legalCapture";
        case CHECK: return "check";
        case ILLEGAL: return "illegal";
        case PREMOVE: return "premove";
      }
    },
  },
);

export const EMPTY_SQUARE: Square = Square(0);

const WHITE_MAX: Square = Square(6);

/** The 8x8 grid of squares, indexed by Position. */
export type Board = Brand<Uint8Array, "Board">;

export const Board = {
  create(): Board {
    return new Uint8Array(64) as Board;
  },

  copy(board: Board): Board {
    return new Uint8Array(board) as Board;
  },

  place(board: Board, position: Position, square: Square): void {
    board[position] = square;
  },

  clear(board: Board, position: Position): void {
    board[position] = EMPTY_SQUARE;
  },

  move(board: Board, from: Position, to: Position): void {
    board[to] = board[from]!;
    board[from] = EMPTY_SQUARE;
  },

  at(board: Board, position: Position): Square {
    return board[position] as Square;
  },

  isOccupiedAt(board: Board, position: Position): boolean {
    return board[position] !== EMPTY_SQUARE;
  },

  *squares(
    board: Board,
  ): Generator<{ value: number; position: Position }, void, void> {
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const pos = Position.create(File(f), Rank(r));
        yield { value: board[pos]!, position: pos };
      }
    }
  },
};
