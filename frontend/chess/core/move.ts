import type { Brand } from "./brand";
import type { Piece, PieceType } from "./piece";

import { PAWN, WHITE } from "./piece";
import { Position, Rank, FILE_A, FILE_D, FILE_F, FILE_H } from "./position";

export type MoveType = Brand<number, "MoveType">;

export const MoveType = (value: number): MoveType => value as MoveType;

export const NORMAL: MoveType = MoveType(0);
export const CASTLING: MoveType = MoveType(1);
export const EN_PASSANT: MoveType = MoveType(2);
export const PROMOTION: MoveType = MoveType(3);

export const MAX_MOVES = 32;

export interface Move {
  piece: Piece;
  from: Position;
  to: Position;
  type: MoveType;
  promoteTo: PieceType | null;
  captured: Piece | null;
  san?: string;
}

export const Move = {
  isDoublePawnPush(move: Move): boolean {
    if (move.piece.type !== PAWN) return false;
    const rankDiff = Position.rank(move.to) - Position.rank(move.from);
    return move.piece.color === WHITE ? rankDiff === 2 : rankDiff === -2;
  },

  enPassantTarget(move: Move): Position {
    const step = move.piece.color === WHITE ? 1 : -1;
    const [rank] = Rank.add(Position.rank(move.from), step);
    return Position.create(Position.file(move.to), rank);
  },

  enPassantCapturedPosition(move: Move): Position {
    return Position.create(Position.file(move.to), Position.rank(move.from));
  },

  isEqual(a: Move, b: Move): boolean {
    if (
      a.from !== b.from ||
      a.to !== b.to ||
      a.type !== b.type ||
      a.piece.type !== b.piece.type
    ) {
      return false;
    }
    if (a.promoteTo !== b.promoteTo) return false;
    return (
      a.captured?.type === b.captured?.type &&
      a.captured?.color === b.captured?.color
    );
  },

  castlingRookPositions(move: Move): [Position, Position] {
    const rank = Position.rank(move.from);
    if (Position.file(move.to) > Position.file(move.from)) {
      return [Position.create(FILE_H, rank), Position.create(FILE_F, rank)];
    }
    return [Position.create(FILE_A, rank), Position.create(FILE_D, rank)];
  },
};
