import type { TurnContext } from "../core/state";

import { Board, Square } from "../core/board";
import { Piece, KING, WHITE, BLACK } from "../core/piece";
import { Position, File, Rank, NO_POSITION } from "../core/position";
import { MoveContext } from "../core/state";

export function decodeFEN(fen: string): TurnContext {
  const ctx: TurnContext = {
    board: Board.create(),
    sideToMove: WHITE,
    sides: [
      { kingPosition: NO_POSITION, canCastleKingSide: false, canCastleQueenSide: false },
      { kingPosition: NO_POSITION, canCastleKingSide: false, canCastleQueenSide: false },
    ],
    enPassantTarget: NO_POSITION,
    halfMoveClock: 0,
    fullMoveNumber: 0,
  };

  const [placement, sideToMove, castling, enPassant, halfMove, fullMove] = fen.split(" ");

  let rank = 7;
  let file = 0;
  for (const ch of placement!) {
    if (ch === "/") {
      rank--;
      file = 0;
      continue;
    }
    const digit = Number(ch);
    if (!Number.isNaN(digit)) {
      file += digit;
      continue;
    }
    const piece = Piece.parse(ch);
    if (piece) {
      const position = Position.create(File(file), Rank(rank));
      Board.place(ctx.board, position, Square.create(piece));
      if (piece.type === KING) {
        MoveContext.sideOf(ctx, piece.color).kingPosition = position;
      }
      file++;
    }
  }

  ctx.sideToMove = sideToMove === "b" ? BLACK : WHITE;

  if (castling && castling !== "-") {
    if (castling.includes("K")) MoveContext.sideOf(ctx, WHITE).canCastleKingSide = true;
    if (castling.includes("Q")) MoveContext.sideOf(ctx, WHITE).canCastleQueenSide = true;
    if (castling.includes("k")) MoveContext.sideOf(ctx, BLACK).canCastleKingSide = true;
    if (castling.includes("q")) MoveContext.sideOf(ctx, BLACK).canCastleQueenSide = true;
  }

  if (enPassant && enPassant !== "-") {
    ctx.enPassantTarget = Position.parse(enPassant) ?? NO_POSITION;
  }

  ctx.halfMoveClock = halfMove ? parseInt(halfMove, 10) || 0 : 0;
  ctx.fullMoveNumber = fullMove ? parseInt(fullMove, 10) || 0 : 0;

  return ctx;
}
