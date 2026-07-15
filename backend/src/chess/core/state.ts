import { Board } from "./board";
import { Move } from "./move";
import { PieceColor, ROOK, WHITE } from "./piece";
import type { File } from "./position";
import { FILE_A, FILE_H, NO_POSITION, Position } from "./position";

export interface SideState {
  kingPosition: Position;
  canCastleKingSide: boolean;
  canCastleQueenSide: boolean;
}

export const SideState = {
  /** Creates a blank SideState with no castling rights and no king position. */
  empty(): SideState {
    return {
      kingPosition: NO_POSITION,
      canCastleKingSide: false,
      canCastleQueenSide: false,
    };
  },

  /** Returns a shallow copy of the given SideState. */
  copy(side: SideState): SideState {
    return { ...side };
  },

  /** Revokes both castling rights — call when the king moves or castles. */
  clearCastlingRights(side: SideState): void {
    side.canCastleKingSide = false;
    side.canCastleQueenSide = false;
  },

  /** Revokes the single castling right tied to a rook's home file. */
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
  /** Returns the SideState for the given color. */
  sideOf(ctx: MoveContext, color: PieceColor): SideState {
    return color === WHITE ? ctx.sides[0] : ctx.sides[1];
  },

  /**
   * Clears the castling right — if any — forfeited by this move.
   * A rook leaving its home square forfeits one right.
   * A rook captured on its home square forfeits the opponent's right.
   * King moves and castling are handled separately by the move applicator.
   */
  forfeitCastlingRight(ctx: MoveContext, move: Move): void {
    if (move.piece.type === ROOK && Position.rank(move.from) === PieceColor.kingStartRank(move.piece.color)) {
      SideState.clearCastlingRight(MoveContext.sideOf(ctx, move.piece.color), Position.file(move.from));
      return;
    }
    if (
      move.captured &&
      move.captured.type === ROOK &&
      Position.rank(move.to) === PieceColor.kingStartRank(move.captured.color)
    ) {
      SideState.clearCastlingRight(MoveContext.sideOf(ctx, move.captured.color), Position.file(move.to));
    }
  },

  /** Returns `true` when `position` is the moving side's king square. */
  isKingAt(ctx: MoveContext, position: Position): boolean {
    return MoveContext.sideOf(ctx, ctx.sideToMove).kingPosition === position;
  },

  /** Sets or clears the en passant target square — call after every move. */
  setEnPassantTarget(ctx: MoveContext, move: Move): void {
    ctx.enPassantTarget = Move.isDoublePawnPush(move) ? Move.enPassantTarget(move) : NO_POSITION;
  },
};

export interface TurnContext extends MoveContext, ClockContext {}

export const TurnContext = {
  /** Creates a blank TurnContext with an empty board and all rights cleared. */
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

  /** Returns a deep copy with its own independent Board. */
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

/**
 * The serialisable position snapshot — the complete game state as plain data,
 * suitable for hashing, persistence, and API responses.
 */
export interface ChessState extends TurnContext {
  /** Incremental Zobrist hash of the position (64-bit, stored as bigint). */
  hash: bigint;
}
