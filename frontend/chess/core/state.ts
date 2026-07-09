import type { File } from "./position";

import { Move } from "./move";
import { Board } from "./board";
import { ROOK, WHITE, PieceColor } from "./piece";
import { FILE_A, FILE_H, NO_POSITION, Position } from "./position";

export interface SideState {
  kingPosition: Position;
  canCastleKingSide: boolean;
  canCastleQueenSide: boolean;
}

export const SideState = {
  empty(): SideState {
    return {
      kingPosition: NO_POSITION,
      canCastleKingSide: false,
      canCastleQueenSide: false,
    };
  },

  copy(side: SideState): SideState {
    return { ...side };
  },

  clearCastlingRights(side: SideState): void {
    side.canCastleKingSide = false;
    side.canCastleQueenSide = false;
  },

  clearCastlingRight(side: SideState, file: File): void {
    if (file === FILE_A) {
      side.canCastleQueenSide = false;
      return;
    }
    if (file === FILE_H) {
      side.canCastleKingSide = false;
    }
  },
};

export interface BoardContext {
  board: Board;
}

export interface MoveContext extends BoardContext {
  sideToMove: PieceColor;
  sides: [SideState, SideState];
  enPassantTarget: Position;
}

export interface ClockContext {
  halfMoveClock: number;
  fullMoveNumber: number;
}

export const MoveContext = {
  sideOf(ctx: MoveContext, color: PieceColor): SideState {
    return color === WHITE ? ctx.sides[0] : ctx.sides[1];
  },

  forfeitCastlingRight(ctx: MoveContext, move: Move): void {
    if (
      move.piece.type === ROOK &&
      Position.rank(move.from) === PieceColor.kingStartRank(move.piece.color)
    ) {
      SideState.clearCastlingRight(
        MoveContext.sideOf(ctx, move.piece.color),
        Position.file(move.from),
      );
      return;
    }
    if (
      move.captured &&
      move.captured.type === ROOK &&
      Position.rank(move.to) === PieceColor.kingStartRank(move.captured.color)
    ) {
      SideState.clearCastlingRight(
        MoveContext.sideOf(ctx, move.captured.color),
        Position.file(move.to),
      );
    }
  },

  isKingAt(ctx: MoveContext, position: Position): boolean {
    return MoveContext.sideOf(ctx, ctx.sideToMove).kingPosition === position;
  },

  setEnPassantTarget(ctx: MoveContext, move: Move): void {
    ctx.enPassantTarget = Move.isDoublePawnPush(move)
      ? Move.enPassantTarget(move)
      : NO_POSITION;
  },
};

export interface TurnContext extends MoveContext, ClockContext {}

export const TurnContext = {
  create(): TurnContext {
    return {
      board: Board.create(),
      sideToMove: WHITE,
      sides: [SideState.empty(), SideState.empty()],
      enPassantTarget: NO_POSITION,
      halfMoveClock: 0,
      fullMoveNumber: 0,
    };
  },

  copy(ctx: TurnContext): TurnContext {
    return {
      board: Board.copy(ctx.board),
      sideToMove: ctx.sideToMove,
      sides: [SideState.copy(ctx.sides[0]), SideState.copy(ctx.sides[1])],
      enPassantTarget: ctx.enPassantTarget,
      halfMoveClock: ctx.halfMoveClock,
      fullMoveNumber: ctx.fullMoveNumber,
    };
  },
};

export interface ChessState extends TurnContext {
  hash: bigint;
}
