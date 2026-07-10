import type { Move } from "../core/move";
import type { TurnContext } from "../core/state";

import { Board, Square } from "../core/board";
import { KING, PAWN, BLACK } from "../core/piece";
import { Move as MoveHelper, NORMAL, PROMOTION, CASTLING, EN_PASSANT } from "../core/move";
import { Snapshot } from "../core/history";
import { MoveContext, SideState } from "../core/state";

export function applyImpl(ctx: TurnContext, move: Move): Snapshot {
  const snap = Snapshot.create(ctx, move);

  switch (move.type) {
    case NORMAL:
      applyNormalImpl(ctx, move);
      break;
    case PROMOTION:
      applyPromotionImpl(ctx, move);
      break;
    case CASTLING:
      applyCastlingImpl(ctx, move);
      break;
    case EN_PASSANT:
      applyEnPassantImpl(ctx, move);
      break;
  }

  MoveContext.setEnPassantTarget(ctx, move);

  if (move.piece.type === PAWN || move.captured) {
    ctx.halfMoveClock = 0;
  } else {
    ctx.halfMoveClock++;
  }

  if (move.piece.color === BLACK) {
    ctx.fullMoveNumber++;
  }

  return snap;
}

function applyNormalImpl(ctx: TurnContext, move: Move): void {
  Board.move(ctx.board, move.from, move.to);

  if (move.piece.type === KING) {
    ctx.sides[move.piece.color]!.kingPosition = move.to;
    SideState.clearCastlingRights(ctx.sides[move.piece.color]!);
  }

  MoveContext.forfeitCastlingRight(ctx, move);
}

function applyPromotionImpl(ctx: TurnContext, move: Move): void {
  Board.move(ctx.board, move.from, move.to);
  if (move.promoteTo) {
    Board.place(ctx.board, move.to, Square.create({ type: move.promoteTo, color: move.piece.color }));
  }

  MoveContext.forfeitCastlingRight(ctx, move);
}

function applyCastlingImpl(ctx: TurnContext, move: Move): void {
  Board.move(ctx.board, move.from, move.to);

  const [rookFrom, rookTo] = MoveHelper.castlingRookPositions(move);
  Board.move(ctx.board, rookFrom, rookTo);

  ctx.sides[move.piece.color]!.kingPosition = move.to;
  SideState.clearCastlingRights(ctx.sides[move.piece.color]!);
}

function applyEnPassantImpl(ctx: TurnContext, move: Move): void {
  Board.move(ctx.board, move.from, move.to);

  Board.clear(ctx.board, MoveHelper.enPassantCapturedPosition(move));
}
