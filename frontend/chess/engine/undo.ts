import type { Move } from "../core/move"
import type { Snapshot } from "../core/history"
import type { TurnContext } from "../core/state"

import { Board, Square } from "../core/board"
import { Move as MoveHelper } from "../core/move"
import { NORMAL, PROMOTION, CASTLING, EN_PASSANT } from "../core/move"

export function undoImpl(ctx: TurnContext, snap: Snapshot): void {
  const move = snap.move

  switch (move.type) {
    case NORMAL:
      undoNormalImpl(ctx, move)
      break
    case PROMOTION:
      undoPromotionImpl(ctx, move)
      break
    case CASTLING:
      undoCastlingImpl(ctx, move)
      break
    case EN_PASSANT:
      undoEnPassantImpl(ctx, move)
      break
  }

  ctx.sides = snap.previousSides
  ctx.enPassantTarget = snap.previousEnPassantTarget
  ctx.halfMoveClock = snap.previousHalfMoveClock
  ctx.fullMoveNumber = snap.previousFullMoveNumber
}

function undoNormalImpl(ctx: TurnContext, move: Move): void {
  Board.move(ctx.board, move.to, move.from)

  if (move.captured) {
    Board.place(ctx.board, move.to, Square.create(move.captured))
  }
}

function undoPromotionImpl(ctx: TurnContext, move: Move): void {
  Board.clear(ctx.board, move.to)

  Board.place(ctx.board, move.from, Square.create(move.piece))

  if (move.captured) {
    Board.place(ctx.board, move.to, Square.create(move.captured))
  }
}

function undoCastlingImpl(ctx: TurnContext, move: Move): void {
  Board.clear(ctx.board, move.to)
  Board.place(ctx.board, move.from, Square.create(move.piece))

  const [rookFrom, rookTo] = MoveHelper.castlingRookPositions(move)
  Board.move(ctx.board, rookTo, rookFrom)
}

function undoEnPassantImpl(ctx: TurnContext, move: Move): void {
  Board.clear(ctx.board, move.to)
  Board.place(ctx.board, move.from, Square.create(move.piece))

  if (move.captured) {
    Board.place(
      ctx.board,
      MoveHelper.enPassantCapturedPosition(move),
      Square.create(move.captured)
    )
  }
}
