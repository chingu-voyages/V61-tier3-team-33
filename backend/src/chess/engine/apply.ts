import { Board, Square } from "../core/board";
import { Snapshot } from "../core/history";
import type { Move } from "../core/move";
import { CASTLING, EN_PASSANT, Move as MoveHelper, NORMAL, PROMOTION } from "../core/move";
import { BLACK, KING, PAWN } from "../core/piece";
import type { TurnContext } from "../core/state";
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

  // en passant target: set on double pawn push, cleared otherwise
  MoveContext.setEnPassantTarget(ctx, move);

  // update the half-move clock: reset on pawn moves and captures,
  // increment otherwise
  if (move.piece.type === PAWN || move.captured) {
    ctx.halfMoveClock = 0;
  } else {
    ctx.halfMoveClock++;
  }

  // update the full-move number: increment after black moves
  if (move.piece.color === BLACK) {
    ctx.fullMoveNumber++;
  }

  return snap;
}

function applyNormalImpl(ctx: TurnContext, move: Move): void {
  // move the piece (mover is unchanged for a normal move)
  Board.move(ctx.board, move.from, move.to);

  // king moves update king position and forfeit all castling rights
  if (move.piece.type === KING) {
    ctx.sides[move.piece.color]!.kingPosition = move.to;
    SideState.clearCastlingRights(ctx.sides[move.piece.color]!);
  }

  // rook moves and rook captures each forfeit one castling right
  MoveContext.forfeitCastlingRight(ctx, move);
}

function applyPromotionImpl(ctx: TurnContext, move: Move): void {
  // move the pawn and promote it
  Board.move(ctx.board, move.from, move.to);
  if (move.promoteTo) {
    Board.place(ctx.board, move.to, Square.create({ type: move.promoteTo, color: move.piece.color }));
  }

  // check if the pawn captured a rook to forfeit the castle rights for enemy
  MoveContext.forfeitCastlingRight(ctx, move);
}

function applyCastlingImpl(ctx: TurnContext, move: Move): void {
  // move the king
  Board.move(ctx.board, move.from, move.to);

  // move the rook: king-side H->F, queen-side A->D
  const [rookFrom, rookTo] = MoveHelper.castlingRookPositions(move);
  Board.move(ctx.board, rookFrom, rookTo);

  // castling forfeits all castling rights
  ctx.sides[move.piece.color]!.kingPosition = move.to;
  SideState.clearCastlingRights(ctx.sides[move.piece.color]!);
}

function applyEnPassantImpl(ctx: TurnContext, move: Move): void {
  // move the pawn
  Board.move(ctx.board, move.from, move.to);

  // remove the captured pawn (sits behind the destination, not on it)
  Board.clear(ctx.board, MoveHelper.enPassantCapturedPosition(move));
}
