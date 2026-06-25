import type { IPiece } from "./piece";
import type { Move } from "../core/move";
import type { BoardContext, MoveContext } from "../core/state";
import type { PieceColor, Piece } from "../core/piece";

import { Board, Square } from "../core/board";
import { BISHOP } from "../core/piece";
import { Position, File, Rank } from "../core/position";
import { NORMAL } from "../core/move";

// Direction vectors: [fileDelta, rankDelta]
export const BishopDirections: [number, number][] = [
  [1, 1],   // up-right
  [1, -1],  // down-right
  [-1, 1],  // up-left
  [-1, -1], // down-left
];

export class Bishop implements IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean {
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

        const position = Position.create(file, rank);
        const square = Board.at(ctx.board, position);

        if (Square.isEmpty(square)) {
          continue;
        }

        if (Square.isOccupiedByAny(square, color, BISHOP)) {
          return true;
        }

        break;
      }
    }

    return false;
  }

  attacks(attacks: Position[], from: Position, ctx: BoardContext): Position[] {
    for (const [fileDelta, rankDelta] of BishopDirections) {
      let file = Position.file(from);
      let rank = Position.rank(from);

      while (true) {
        const [nextFile, isFileValid] = File.add(file, fileDelta);
        const [nextRank, isRankValid] = Rank.add(rank, rankDelta);

        if (!isFileValid || !isRankValid) {
          break;
        }

        file = nextFile;
        rank = nextRank;

        const position = Position.create(file, rank);
        attacks.push(position);

        const square = Board.at(ctx.board, position);
        if (Square.isOccupied(square)) {
          break;
        }
      }
    }

    return attacks;
  }

  pseudoLegalMoves(moves: Move[], from: Position, ctx: MoveContext): Move[] {
    const bishop: Piece = { type: BISHOP, color: ctx.sideToMove };

    for (const [fileDelta, rankDelta] of BishopDirections) {
      let file = Position.file(from);
      let rank = Position.rank(from);

      while (true) {
        const [nextFile, isFileValid] = File.add(file, fileDelta);
        const [nextRank, isRankValid] = Rank.add(rank, rankDelta);

        if (!isFileValid || !isRankValid) {
          break;
        }

        file = nextFile;
        rank = nextRank;

        const to = Position.create(file, rank);
        const square = Board.at(ctx.board, to);

        if (Square.isOccupiedBy(square, ctx.sideToMove)) {
          break;
        }

        const move: Move = {
          piece: bishop,
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
          moves.push(move);
          break;
        }

        moves.push(move);
      }
    }

    return moves;
  }
}
