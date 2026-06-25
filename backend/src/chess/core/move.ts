import type { Brand } from "./brand";
import type { Piece, PieceType } from "./piece";

import { PAWN, WHITE } from "./piece";
import { Position, Rank, FILE_A, FILE_D, FILE_F, FILE_H } from "./position";

/** Discriminates between the four kinds of chess moves. */
export type MoveType = Brand<number, "MoveType">;

export const MoveType = (value: number): MoveType => value as MoveType;

/** Regular move or capture by one piece. */
export const NORMAL: MoveType = MoveType(0);

/**
 * Moves the king two squares toward a rook, then moves that rook to the
 * square the king crossed.
 */
export const CASTLING: MoveType = MoveType(1);

/**
 * Pawn captures a pawn that just advanced two squares, moving diagonally
 * to the skipped square.
 */
export const EN_PASSANT: MoveType = MoveType(2);

/** Replaces a pawn with another piece after it reaches the last rank. */
export const PROMOTION: MoveType = MoveType(3);

/**
 * Buffer size that guarantees `pseudoLegalMoves` and `attacks` never need to
 * grow their backing array. The largest single-piece move set is a queen on a
 * wide-open board (27 moves); a king with two castling moves adds at most 2
 * more. 32 provides headroom over both.
 */
export const MAX_MOVES = 32;

export interface Move {
  piece: Piece;
  from: Position;
  to: Position;
  type: MoveType;
  /** `null` when `type !== PROMOTION`. */
  promoteTo: PieceType | null;
  /** `null` when this is not a capture. */
  captured: Piece | null;
}

export const Move = {
  /**
   * Returns `true` if this move is a pawn advancing two squares from its
   * starting rank. Used to set the en passant target.
   */
  isDoublePawnPush(move: Move): boolean {
    if (move.piece.type !== PAWN) return false;
    const rankDiff = Position.rank(move.to) - Position.rank(move.from);
    return move.piece.color === WHITE ? rankDiff === 2 : rankDiff === -2;
  },

  /**
   * Returns the square an enemy pawn would land on when capturing en passant
   * against the pushed pawn. Stored in `ctx.enPassantTarget` after every double
   * pawn push so the next ply knows where a capture is legal.
   *
   * This is the square *between* `from` and `to` — one step ahead of where the
   * pawn started, on the same file it landed on.
   *
   * ```
   * White pushes e2→e4:  target = e3  (rank(e2)+1, file(e4))
   * Black pushes e7→e5:  target = e6  (rank(e7)-1, file(e5))
   * ```
   *
   * Only meaningful when `isDoublePawnPush()` is true.
   */
  enPassantTarget(move: Move): Position {
    const step = move.piece.color === WHITE ? 1 : -1;
    const [rank] = Rank.add(Position.rank(move.from), step);
    return Position.create(Position.file(move.to), rank);
  },

  /**
   * Returns the square occupied by the pawn being captured en passant.
   *
   * The capturing pawn moves *diagonally* to `ctx.enPassantTarget`, but the
   * captured pawn never moved there — it sits one rank behind, level with the
   * attacker. That square is `(file(to), rank(from))`.
   *
   * ```
   * Black captures d4→e3:  captured pawn is on e4  (file(e3), rank(d4))
   * White captures e5→d6:  captured pawn is on d5  (file(d6), rank(e5))
   * ```
   *
   * The board applicator clears this square in addition to moving the
   * capturing pawn. Only meaningful when `type === EN_PASSANT`.
   */
  enPassantCapturedPosition(move: Move): Position {
    return Position.create(Position.file(move.to), Position.rank(move.from));
  },

  /** Returns `true` when both moves represent the same board action. */
  isEqual(a: Move, b: Move): boolean {
    if (
      a.from !== b.from ||
      a.to !== b.to ||
      a.type !== b.type ||
      a.piece.type !== b.piece.type
    ) {
      return false;
    }
    if (a.promoteTo !== b.promoteTo) return false;
    return (
      a.captured?.type === b.captured?.type &&
      a.captured?.color === b.captured?.color
    );
  },

  /**
   * Returns `[rookFrom, rookTo]` for a castling move.
   * King-side: H-file → F-file. Queen-side: A-file → D-file.
   * Only meaningful when `type === CASTLING`.
   */
  castlingRookPositions(move: Move): [Position, Position] {
    const rank = Position.rank(move.from);
    if (Position.file(move.to) > Position.file(move.from)) {
      return [Position.create(FILE_H, rank), Position.create(FILE_F, rank)];
    }
    return [Position.create(FILE_A, rank), Position.create(FILE_D, rank)];
  },
};
