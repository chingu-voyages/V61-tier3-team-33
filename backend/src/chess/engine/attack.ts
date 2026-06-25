import type { BoardContext } from "../core/state";
import type { PieceColor } from "../core/piece";
import type { IPieces } from "../piece/piece";

import { Board, Square } from "../core/board";
import { BISHOP, QUEEN, ROOK } from "../core/piece";
import { Position, File, Rank } from "../core/position";
import { BishopDirections } from "../piece/bishop";
import { RookDirections } from "../piece/rook";

export function isSquareAttackedImpl(
  pieces: IPieces,
  target: Position,
  color: PieceColor,
  ctx: BoardContext,
): boolean {
  if (pieces.knight.isAttacking(color, target, ctx)) {
    return true;
  }
  if (pieces.king.isAttacking(color, target, ctx)) {
    return true;
  }
  if (pieces.pawn.isAttacking(color, target, ctx)) {
    return true;
  }

  // inline slider scan (not bishop/rook/queen.isAttacking) to cover all three in 8 rays instead of 16
  for (const [fileDelta, rankDelta] of BishopDirections) {
    let file = Position.file(target);
    let rank = Position.rank(target);

    while (true) {
      const [nextFile, isFileValid] = File.add(file, fileDelta);
      const [nextRank, isRankValid] = Rank.add(rank, rankDelta);

      if (!isFileValid || !isRankValid) {
        break;
      }

      file = nextFile;
      rank = nextRank;

      const square = Board.at(ctx.board, Position.create(file, rank));

      if (Square.isOccupiedByAny(square, color, BISHOP, QUEEN)) {
        return true;
      }

      if (Square.isOccupied(square)) {
        break;
      }
    }
  }

  for (const [fileDelta, rankDelta] of RookDirections) {
    let file = Position.file(target);
    let rank = Position.rank(target);

    while (true) {
      const [nextFile, isFileValid] = File.add(file, fileDelta);
      const [nextRank, isRankValid] = Rank.add(rank, rankDelta);

      if (!isFileValid || !isRankValid) {
        break;
      }

      file = nextFile;
      rank = nextRank;

      const square = Board.at(ctx.board, Position.create(file, rank));

      if (Square.isOccupiedByAny(square, color, ROOK, QUEEN)) {
        return true;
      }

      if (Square.isOccupied(square)) {
        break;
      }
    }
  }

  return false;
}
