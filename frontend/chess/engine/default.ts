import type { Move } from "../core/move";
import type { PieceColor } from "../core/piece";
import type { Position } from "../core/position";
import type { Snapshot } from "../core/history";
import type { IPieces } from "../piece/piece";
import type { BoardContext, TurnContext } from "../core/state";

import type { IEngine } from "./engine";

import { getDefaultPieces } from "../piece/default";
import { isSquareAttackedImpl } from "./attack";
import { getPseudoLegalMovesImpl } from "./psuedo";
import { getLegalMovesImpl, getAllLegalMovesImpl, hasAnyLegalMovesImpl, isLegalMoveImpl } from "./move";
import { applyImpl } from "./apply";
import { undoImpl } from "./undo";

export class DefaultEngine implements IEngine {
  pieces: IPieces;

  constructor(pieces: IPieces = getDefaultPieces()) {
    this.pieces = pieces;
  }

  getPseudoLegalMoves(moves: Move[], position: Position, ctx: TurnContext): Move[] {
    return getPseudoLegalMovesImpl(this.pieces, moves, position, ctx);
  }

  getLegalMoves(moves: Move[], position: Position, ctx: TurnContext): Move[] {
    return getLegalMovesImpl(this.pieces, moves, position, ctx);
  }

  getAllLegalMoves(moves: Move[], ctx: TurnContext): Move[] {
    return getAllLegalMovesImpl(this.pieces, moves, ctx);
  }

  hasAnyLegalMoves(ctx: TurnContext): boolean {
    return hasAnyLegalMovesImpl(this.pieces, ctx);
  }

  isLegalMove(move: Move, ctx: TurnContext): boolean {
    return isLegalMoveImpl(this.pieces, move, ctx);
  }

  isSquareAttacked(position: Position, attackerColor: PieceColor, ctx: BoardContext): boolean {
    return isSquareAttackedImpl(this.pieces, position, attackerColor, ctx);
  }

  apply(ctx: TurnContext, move: Move): Snapshot {
    return applyImpl(ctx, move);
  }

  undo(ctx: TurnContext, snap: Snapshot): void {
    undoImpl(ctx, snap);
  }
}

const defaultEngine = new DefaultEngine();

export function getDefaultEngine(): DefaultEngine {
  return defaultEngine;
}
