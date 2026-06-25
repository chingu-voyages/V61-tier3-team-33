import type { IPiece } from "./piece";
import type { Move } from "../core/move";
import type { BoardContext, MoveContext } from "../core/state";
import type { PieceColor, Piece } from "../core/piece";

import { Board, Square } from "../core/board";
import { KING } from "../core/piece";
import { Position, File, Rank } from "../core/position";
import { NORMAL } from "../core/move";

// King moves one square in any direction: straight (rook) + diagonal (bishop).
export const KingDirections: [number, number][] = [
  [0, 1],  // up
  [0, -1], // down
  [-1, 0], // left
  [1, 0],  // right
  [1, 1],   // up-right
  [1, -1],  // down-right
  [-1, 1],  // up-left
  [-1, -1], // down-left
];

export class King implements IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean {
    for (const [fileDelta, rankDelta] of KingDirections) {
      const [nextFile, isFileValid] = File.add(Position.file(target), fileDelta);
      const [nextRank, isRankValid] = Rank.add(Position.rank(target), rankDelta);

      if (!isFileValid || !isRankValid) {
        continue;
      }

      const position = Position.create(nextFile, nextRank);
      const square = Board.at(ctx.board, position);
      if (Square.isOccupiedByAny(square, color, KING)) {
        return true;
      }
    }

    return false;
  }

  attacks(attacks: Position[], from: Position, _ctx: BoardContext): Position[] {
    for (const [fileDelta, rankDelta] of KingDirections) {
      const [file, isFileValid] = File.add(Position.file(from), fileDelta);
      const [rank, isRankValid] = Rank.add(Position.rank(from), rankDelta);

      if (isFileValid && isRankValid) {
        attacks.push(Position.create(file, rank));
      }
    }

    return attacks;
  }

  pseudoLegalMoves(moves: Move[], from: Position, ctx: MoveContext): Move[] {
    const piece: Piece = { type: KING, color: ctx.sideToMove };

    for (const [fileDelta, rankDelta] of KingDirections) {
      const [file, isFileValid] = File.add(Position.file(from), fileDelta);
      const [rank, isRankValid] = Rank.add(Position.rank(from), rankDelta);

      if (!isFileValid || !isRankValid) {
        continue;
      }

      const to = Position.create(file, rank);
      const square = Board.at(ctx.board, to);

      if (Square.isOccupiedBy(square, ctx.sideToMove)) {
        continue;
      }

      const move: Move = {
        piece,
        from,
        to,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };

      if (Square.isOccupied(square)) {
        move.captured = {
          type: Square.pieceType(square),
          color: Square.pieceColor(square),
        };
      }

      moves.push(move);
    }

    return moves;
  }
}
