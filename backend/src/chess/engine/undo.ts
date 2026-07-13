import { Board, Square } from "../core/board";
import type { Snapshot } from "../core/history";
import type { Move } from "../core/move";
import { Move as MoveHelper } from "../core/move";
import { CASTLING, EN_PASSANT, NORMAL, PROMOTION } from "../core/move";
import type { TurnContext } from "../core/state";

export function undoImpl(ctx: TurnContext, snap: Snapshot): void {
  const move = snap.move;

  switch (move.type) {
    case NORMAL:
      undoNormalImpl(ctx, move);
      break;
    case PROMOTION:
      undoPromotionImpl(ctx, move);
      break;
    case CASTLING:
      undoCastlingImpl(ctx, move);
      break;
    case EN_PASSANT:
      undoEnPassantImpl(ctx, move);
      break;
  }

  // restore state captured at the start of apply
  ctx.sides = snap.previousSides;
  ctx.enPassantTarget = snap.previousEnPassantTarget;
  ctx.halfMoveClock = snap.previousHalfMoveClock;
  ctx.fullMoveNumber = snap.previousFullMoveNumber;
}

function undoNormalImpl(ctx: TurnContext, move: Move): void {
  // move the piece back to its origin
  Board.move(ctx.board, move.to, move.from);

  // restore captured piece, if any
  if (move.captured) {
    Board.place(ctx.board, move.to, Square.create(move.captured));
  }
}

function undoPromotionImpl(ctx: TurnContext, move: Move): void {
  // clear the promoted piece
  Board.clear(ctx.board, move.to);

  // return the pawn back to its position
  Board.place(ctx.board, move.from, Square.create(move.piece));

  // restore captured piece, if any
  if (move.captured) {
    Board.place(ctx.board, move.to, Square.create(move.captured));
  }
}

function undoCastlingImpl(ctx: TurnContext, move: Move): void {
  // restore king to origin, clear destination
  Board.clear(ctx.board, move.to);
  Board.place(ctx.board, move.from, Square.create(move.piece));

  // restore rook: king-side F->H, queen-side D->A
  const [rookFrom, rookTo] = MoveHelper.castlingRookPositions(move);
  Board.move(ctx.board, rookTo, rookFrom);
}

function undoEnPassantImpl(ctx: TurnContext, move: Move): void {
  // restore pawn to origin, clear destination
  Board.clear(ctx.board, move.to);
  Board.place(ctx.board, move.from, Square.create(move.piece));

  // restore the captured pawn behind the destination
  if (move.captured) {
    Board.place(ctx.board, MoveHelper.enPassantCapturedPosition(move), Square.create(move.captured));
  }
}
