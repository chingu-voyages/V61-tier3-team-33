import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { NORMAL } from "../core/move";
import type { Piece, PieceColor } from "../core/piece";
import { QUEEN } from "../core/piece";
import { File, Position, Rank } from "../core/position";
import type { BoardContext, MoveContext } from "../core/state";
import type { IPiece } from "./piece";

// Queen moves like a rook (straight) and a bishop (diagonal).
export const QueenDirections: [number, number][] = [
  [0, 1], // up
  [0, -1], // down
  [-1, 0], // left
  [1, 0], // right
  [1, 1], // up-right
  [1, -1], // down-right
  [-1, 1], // up-left
  [-1, -1], // down-left
];

export class Queen implements IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean {
    for (const [fileDelta, rankDelta] of QueenDirections) {
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

        if (Square.isOccupiedByAny(square, color, QUEEN)) {
          return true;
        }

        break;
      }
    }

    return false;
  }

  attacks(attacks: Position[], from: Position, ctx: BoardContext): Position[] {
    for (const [fileDelta, rankDelta] of QueenDirections) {
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
    const piece: Piece = { type: QUEEN, color: ctx.sideToMove };

    for (const [fileDelta, rankDelta] of QueenDirections) {
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
