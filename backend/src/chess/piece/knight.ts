import type { IPiece } from "./piece";
import type { Move } from "../core/move";
import type { BoardContext, MoveContext } from "../core/state";
import type { PieceColor, Piece } from "../core/piece";

import { Board, Square } from "../core/board";
import { KNIGHT } from "../core/piece";
import { Position, File, Rank } from "../core/position";
import { NORMAL } from "../core/move";

// Knight L-shapes: all combinations of ±1 and ±2: [fileDelta, rankDelta]
export const KnightDirections: [number, number][] = [
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
];

export class Knight implements IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean {
    for (const [fileDelta, rankDelta] of KnightDirections) {
      const [nextFile, isFileValid] = File.add(
        Position.file(target),
        fileDelta,
      );
      const [nextRank, isRankValid] = Rank.add(
        Position.rank(target),
        rankDelta,
      );

      if (!isFileValid || !isRankValid) {
        continue;
      }

      const position = Position.create(nextFile, nextRank);
      const square = Board.at(ctx.board, position);
      if (Square.isOccupiedByAny(square, color, KNIGHT)) {
        return true;
      }
    }

    return false;
  }

  attacks(attacks: Position[], from: Position, _ctx: BoardContext): Position[] {
    for (const [fileDelta, rankDelta] of KnightDirections) {
      const [file, isFileValid] = File.add(Position.file(from), fileDelta);
      const [rank, isRankValid] = Rank.add(Position.rank(from), rankDelta);

      if (isFileValid && isRankValid) {
        attacks.push(Position.create(file, rank));
      }
    }

    return attacks;
  }

  pseudoLegalMoves(moves: Move[], from: Position, ctx: MoveContext): Move[] {
    const piece: Piece = { type: KNIGHT, color: ctx.sideToMove };

    for (const [fileDelta, rankDelta] of KnightDirections) {
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
