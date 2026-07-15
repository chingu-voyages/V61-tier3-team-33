import type { Move } from "../core/move"
import type { PieceColor } from "../core/piece"
import type { Position } from "../core/position"
import type { Snapshot } from "../core/history"
import type { BoardContext, TurnContext } from "../core/state"

export interface IEngine {
  /** Pseudo-legal moves for piece at position. */
  getPseudoLegalMoves(
    moves: Move[],
    position: Position,
    ctx: TurnContext
  ): Move[]

  /** Moves that don't leave king in check. */
  getLegalMoves(moves: Move[], position: Position, ctx: TurnContext): Move[]

  /** All legal moves for side to move. */
  getAllLegalMoves(moves: Move[], ctx: TurnContext): Move[]

  /** Whether side to move has any legal move. */
  hasAnyLegalMoves(ctx: TurnContext): boolean

  /** Whether move is legal. */
  isLegalMove(move: Move, ctx: TurnContext): boolean

  /** Whether any piece of color attacks position. */
  isSquareAttacked(
    position: Position,
    attackerColor: PieceColor,
    ctx: BoardContext
  ): boolean

  /** Applies move, returns Snapshot for undo. */
  apply(ctx: TurnContext, move: Move): Snapshot

  /** Reverses apply via Snapshot. */
  undo(ctx: TurnContext, snap: Snapshot): void
}

/** Buffer size for getAllLegalMoves (max 218). */
export const MAX_TOTAL_MOVES = 256
