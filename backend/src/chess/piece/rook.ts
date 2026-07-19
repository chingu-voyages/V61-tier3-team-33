import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { NORMAL } from "../core/move";
import type { Piece, PieceColor } from "../core/piece";
import { ROOK } from "../core/piece";
import { File, Position, Rank } from "../core/position";
import type { BoardContext, MoveContext } from "../core/state";
import type { IPiece } from "./piece";

// Direction vectors: [fileDelta, rankDelta]
export const RookDirections: [number, number][] = [
  [0, 1], // up (same file, next rank)
  [0, -1], // down (same file, previous rank)
  [-1, 0], // left (previous file, same rank)
  [1, 0], // right (next file, same rank)
];

export class Rook implements IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean {
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

        const position = Position.create(file, rank);
        const square = Board.at(ctx.board, position);

        if (Square.isEmpty(square)) {
          continue;
        }

        if (Square.isOccupiedByAny(square, color, ROOK)) {
          return true;
        }

        break;
      }
    }

    return false;
  }

  attacks(attacks: Position[], from: Position, ctx: BoardContext): Position[] {
    for (const [fileDelta, rankDelta] of RookDirections) {
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
    const piece: Piece = { type: ROOK, color: ctx.sideToMove };

    for (const [fileDelta, rankDelta] of RookDirections) {
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
          moves.push(move);
          break;
        }

        moves.push(move);
      }
    }

    return moves;
  }
}
