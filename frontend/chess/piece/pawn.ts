import type { IPiece } from "./piece";
import type { Move } from "../core/move";
import type { BoardContext, MoveContext } from "../core/state";
import type { Piece, PieceType } from "../core/piece";

import { Board, Square } from "../core/board";
import {
  PAWN,
  BISHOP,
  KNIGHT,
  QUEEN,
  ROOK,
  WHITE,
  PieceColor,
} from "../core/piece";
import {
  Position,
  File,
  Rank,
  RANK_2,
  RANK_7,
  RANK_8,
  RANK_1,
} from "../core/position";
import { NORMAL, PROMOTION, EN_PASSANT } from "../core/move";

const PROMOTION_TYPES: PieceType[] = [QUEEN, ROOK, BISHOP, KNIGHT];

export class Pawn implements IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean {
    const step = this.direction(color).step;

    const [rank, isRankValid] = Rank.add(Position.rank(target), -step);
    if (!isRankValid) {
      return false;
    }

    const [rightFile, isRightFileValid] = File.add(Position.file(target), 1);
    if (isRightFileValid) {
      const position = Position.create(rightFile, rank);
      const square = Board.at(ctx.board, position);
      if (Square.isOccupiedByAny(square, color, PAWN)) {
        return true;
      }
    }

    const [leftFile, isLeftFileValid] = File.add(Position.file(target), -1);
    if (isLeftFileValid) {
      const position = Position.create(leftFile, rank);
      const square = Board.at(ctx.board, position);
      if (Square.isOccupiedByAny(square, color, PAWN)) {
        return true;
      }
    }

    return false;
  }

  attacks(attacks: Position[], from: Position, ctx: BoardContext): Position[] {
    const fromSquare = Board.at(ctx.board, from);
    const color = Square.pieceColor(fromSquare);
    const step = this.direction(color).step;

    const [rank, isRankValid] = Rank.add(Position.rank(from), step);
    if (!isRankValid) {
      return attacks;
    }

    const [rightFile, isRightFileValid] = File.add(Position.file(from), 1);
    if (isRightFileValid) {
      attacks.push(Position.create(rightFile, rank));
    }

    const [leftFile, isLeftFileValid] = File.add(Position.file(from), -1);
    if (isLeftFileValid) {
      attacks.push(Position.create(leftFile, rank));
    }

    return attacks;
  }

  pseudoLegalMoves(moves: Move[], from: Position, ctx: MoveContext): Move[] {
    const { step, promotionRank } = this.direction(ctx.sideToMove);

    const [oneRank, isRankValid] = Rank.add(Position.rank(from), step);
    if (!isRankValid) {
      return moves;
    }

    if (oneRank === promotionRank) {
      return this.promotionMoves(moves, from, ctx);
    }

    moves = this.push(moves, from, ctx);
    moves = this.captures(moves, from, ctx);

    return moves;
  }

  private push(moves: Move[], from: Position, ctx: MoveContext): Move[] {
    const pawn: Piece = { type: PAWN, color: ctx.sideToMove };
    const { step, startRank } = this.direction(ctx.sideToMove);

    const [rank] = Rank.add(Position.rank(from), step);

    const forwardPosition = Position.create(Position.file(from), rank);
    const forwardSquare = Board.at(ctx.board, forwardPosition);
    if (Square.isOccupied(forwardSquare)) {
      return moves;
    }

    moves.push({
      piece: pawn,
      from,
      to: forwardPosition,
      type: NORMAL,
      promoteTo: null,
      captured: null,
    });

    if (Position.rank(from) !== startRank) {
      return moves;
    }

    const [doubleRank] = Rank.add(rank, step);
    const doublePosition = Position.create(Position.file(from), doubleRank);
    const doubleSquare = Board.at(ctx.board, doublePosition);
    if (Square.isOccupied(doubleSquare)) {
      return moves;
    }

    moves.push({
      piece: pawn,
      from,
      to: doublePosition,
      type: NORMAL,
      promoteTo: null,
      captured: null,
    });

    return moves;
  }

  private captures(moves: Move[], from: Position, ctx: MoveContext): Move[] {
    const pawn: Piece = { type: PAWN, color: ctx.sideToMove };
    const enemyColor = PieceColor.opponent(ctx.sideToMove);
    const { step } = this.direction(ctx.sideToMove);

    const [rank] = Rank.add(Position.rank(from), step);

    const [rightFile, isRightFileValid] = File.add(Position.file(from), 1);
    if (isRightFileValid) {
      const to = Position.create(rightFile, rank);
      const square = Board.at(ctx.board, to);

      if (to === ctx.enPassantTarget) {
        moves.push({
          piece: pawn,
          from,
          to,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: enemyColor },
        });
      } else if (Square.isOccupiedBy(square, enemyColor)) {
        moves.push({
          piece: pawn,
          from,
          to,
          type: NORMAL,
          promoteTo: null,
          captured: {
            type: Square.pieceType(square),
            color: Square.pieceColor(square),
          },
        });
      }
    }

    const [leftFile, isLeftFileValid] = File.add(Position.file(from), -1);
    if (isLeftFileValid) {
      const to = Position.create(leftFile, rank);
      const square = Board.at(ctx.board, to);

      if (to === ctx.enPassantTarget) {
        moves.push({
          piece: pawn,
          from,
          to,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: enemyColor },
        });
      } else if (Square.isOccupiedBy(square, enemyColor)) {
        moves.push({
          piece: pawn,
          from,
          to,
          type: NORMAL,
          promoteTo: null,
          captured: {
            type: Square.pieceType(square),
            color: Square.pieceColor(square),
          },
        });
      }
    }

    return moves;
  }

  private promotionMoves(
    moves: Move[],
    from: Position,
    ctx: MoveContext,
  ): Move[] {
    const pawn: Piece = { type: PAWN, color: ctx.sideToMove };
    const enemyColor = PieceColor.opponent(ctx.sideToMove);
    const { step } = this.direction(ctx.sideToMove);

    const [rank] = Rank.add(Position.rank(from), step);

    const forwardPosition = Position.create(Position.file(from), rank);
    const forwardSquare = Board.at(ctx.board, forwardPosition);
    if (Square.isEmpty(forwardSquare)) {
      for (const promoteTo of PROMOTION_TYPES) {
        moves.push({
          piece: pawn,
          from,
          to: forwardPosition,
          type: PROMOTION,
          promoteTo,
          captured: null,
        });
      }
    }

    const [rightFile, isRightFileValid] = File.add(Position.file(from), 1);
    if (isRightFileValid) {
      const to = Position.create(rightFile, rank);
      const square = Board.at(ctx.board, to);
      if (Square.isOccupiedBy(square, enemyColor)) {
        const captured = {
          type: Square.pieceType(square),
          color: Square.pieceColor(square),
        };
        for (const promoteTo of PROMOTION_TYPES) {
          moves.push({
            piece: pawn,
            from,
            to,
            type: PROMOTION,
            promoteTo,
            captured,
          });
        }
      }
    }

    const [leftFile, isLeftFileValid] = File.add(Position.file(from), -1);
    if (isLeftFileValid) {
      const to = Position.create(leftFile, rank);
      const square = Board.at(ctx.board, to);
      if (Square.isOccupiedBy(square, enemyColor)) {
        const captured = {
          type: Square.pieceType(square),
          color: Square.pieceColor(square),
        };
        for (const promoteTo of PROMOTION_TYPES) {
          moves.push({
            piece: pawn,
            from,
            to,
            type: PROMOTION,
            promoteTo,
            captured,
          });
        }
      }
    }

    return moves;
  }

  private direction(color: PieceColor): {
    step: number;
    startRank: Rank;
    promotionRank: Rank;
  } {
    if (color === WHITE) {
      return { step: 1, startRank: RANK_2, promotionRank: RANK_8 };
    }
    return { step: -1, startRank: RANK_7, promotionRank: RANK_1 };
  }
}
