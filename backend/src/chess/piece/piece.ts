import type { Move } from "../core/move";
import type { PieceColor } from "../core/piece";
import type { Position } from "../core/position";
import type { BoardContext, MoveContext } from "../core/state";

import { Pawn } from "./pawn";
import { Rook } from "./rook";
import { King } from "./king";
import { Queen } from "./queen";
import { Bishop } from "./bishop";
import { Knight } from "./knight";

/**
 * Behavior interface for a single chess piece type.
 *
 * Implementations are stateless (e.g. `new Pawn()`, `new Bishop()`).
 * All position-specific and board-specific information is passed in
 * through method arguments, so the same instance can be reused
 * across the entire program.
 */
export interface IPiece {
  /**
   * Reports whether any piece of this type and color attacks `target`.
   *
   * Scans from target outward using this piece's attack geometry —
   * the right tool for "is my king in check?" or "is this square
   * defended?" when the caller knows target but not candidate sources.
   *
   * Special cases:
   *  - Pawns scan the two squares "behind" target relative to
   *    attacker color (white below, black above).
   *  - Sliders check the first blocker on each ray; queen is covered
   *    by the bishop and rook scans, not dispatched separately.
   */
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean;

  /**
   * Returns every square this piece threatens from the given
   * position, given the current board layout.
   *
   * Includes squares occupied by friendly pieces — a piece "attacks" a
   * square even if it can't move there. Essential for check detection.
   *
   * Special cases:
   *  - Pawns attack diagonally, not forward.
   *  - Castling is NOT an attack.
   *  - Sliders stop at the first occupied square but include it.
   *
   * Color dependency: geometry is color-independent for all pieces
   * except pawn, which reads color from `ctx.board[from]` — so `from`
   * must be occupied when calling `attacks` on a pawn.
   */
  attacks(attacks: Position[], from: Position, ctx: BoardContext): Position[];

  /**
   * Returns all move options this piece has from the given position,
   * respecting movement rules, board edges, blockers, and capture
   * eligibility — but NOT filtering for king safety.
   *
   * Moves that leave the moving side's king in check are still
   * returned; the engine layer applies that filter.
   *
   * Special cases:
   *  - Pawn moves include single push, double push, diagonal
   *    captures, en passant, and promotions.
   *  - Castling is NOT included — the engine adds it.
   */
  pseudoLegalMoves(moves: Move[], from: Position, ctx: MoveContext): Move[];
}

/** All six concrete piece implementations. */
export interface IPieces {
  pawn: Pawn;
  knight: Knight;
  bishop: Bishop;
  rook: Rook;
  queen: Queen;
  king: King;
}
