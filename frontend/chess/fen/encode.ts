import type { TurnContext } from "../core/state"

import { Board, Square } from "../core/board"
import { Piece, WHITE, BLACK } from "../core/piece"
import { Position, File, Rank, NO_POSITION } from "../core/position"
import { MoveContext } from "../core/state"

function encodePiecePlacement(ctx: TurnContext): string {
  const parts: string[] = []
  for (let r = 7; r >= 0; r--) {
    let empty = 0
    let rank = ""
    for (let f = 0; f < 8; f++) {
      const position = Position.create(File(f), Rank(r))
      const square = Board.at(ctx.board, position)
      if (Square.isOccupied(square)) {
        if (empty > 0) {
          rank += String(empty)
          empty = 0
        }
        rank += Piece.toChar({
          type: Square.pieceType(square),
          color: Square.pieceColor(square),
        })
      } else {
        empty++
      }
    }
    if (empty > 0) {
      rank += String(empty)
    }
    parts.push(rank)
  }
  return parts.join("/")
}

function encodeSideToMove(ctx: TurnContext): string {
  return ctx.sideToMove === WHITE ? "w" : "b"
}

function encodeCastlingRights(ctx: TurnContext): string {
  let result = ""
  if (MoveContext.sideOf(ctx, WHITE).canCastleKingSide) result += "K"
  if (MoveContext.sideOf(ctx, WHITE).canCastleQueenSide) result += "Q"
  if (MoveContext.sideOf(ctx, BLACK).canCastleKingSide) result += "k"
  if (MoveContext.sideOf(ctx, BLACK).canCastleQueenSide) result += "q"
  return result || "-"
}

function encodeEnPassantTarget(ctx: TurnContext): string {
  if (ctx.enPassantTarget === NO_POSITION) return "-"
  return Position.toString(ctx.enPassantTarget).toLowerCase()
}

export function encodeFEN(ctx: TurnContext): string {
  return [
    encodePiecePlacement(ctx),
    encodeSideToMove(ctx),
    encodeCastlingRights(ctx),
    encodeEnPassantTarget(ctx),
    String(ctx.halfMoveClock),
    String(ctx.fullMoveNumber),
  ].join(" ")
}
