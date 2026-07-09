import type { Move } from "../core/move";
import type { PieceColor } from "../core/piece";
import type { Position } from "../core/position";
import type { Snapshot } from "../core/history";
import type { BoardContext, TurnContext } from "../core/state";

export interface IEngine {
  /** Returns all pseudo-legal moves for the piece at position. */
  getPseudoLegalMoves(moves: Move[], position: Position, ctx: TurnContext): Move[];

  /** Returns only moves that do not leave the king in check. */
  getLegalMoves(moves: Move[], position: Position, ctx: TurnContext): Move[];

  /** Appends every legal move for the side to move into moves. */
  getAllLegalMoves(moves: Move[], ctx: TurnContext): Move[];

  /** Returns true if the side to move has at least one legal move. */
  hasAnyLegalMoves(ctx: TurnContext): boolean;

  /** Reports whether move is legal in the given context. */
  isLegalMove(move: Move, ctx: TurnContext): boolean;

  /** Reports whether any piece of color attacks position. */
  isSquareAttacked(position: Position, attackerColor: PieceColor, ctx: BoardContext): boolean;

  /** Applies move to ctx in place, returning a Snapshot for undo. */
  apply(ctx: TurnContext, move: Move): Snapshot;

  /** Reverses an apply using the saved Snapshot. */
  undo(ctx: TurnContext, snap: Snapshot): void;
}

/** Buffer size for getAllLegalMoves (theoretical max is 218). */
export const MAX_TOTAL_MOVES = 256;
