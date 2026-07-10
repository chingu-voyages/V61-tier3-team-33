import type { IRules, ITracker } from "./rules";
import type { IEngine } from "../engine/engine";
import type { TurnContext } from "../core/state";
import type { GameResult } from "../core/game";

import { Square } from "../core/board";
import { PAWN, QUEEN, ROOK, BISHOP, KNIGHT, PieceColor, WHITE, BLACK } from "../core/piece";
import { Position } from "../core/position";
import { MoveContext } from "../core/state";
import { IN_PROGRESS, CHECKMATE, DRAW, NO_DRAW_REASON, STALEMATE, THREEFOLD_REPETITION, FIFTY_MOVE_RULE, INSUFFICIENT_MATERIAL } from "../core/game";

export class DefaultRules implements IRules {
  isFiftyMoveRule(ctx: TurnContext): boolean {
    return ctx.halfMoveClock >= 100;
  }

  isThreefoldRepetition(tracker: ITracker, hash: bigint): boolean {
    return tracker.count(hash) >= 3;
  }

  isInsufficientMaterial(ctx: TurnContext): boolean {
    let wBishops = 0, wKnights = 0;
    let bBishops = 0, bKnights = 0;
    let wBishopPosition = Position(0);
    let bBishopPosition = Position(0);

    for (const [i, rawByte] of ctx.board.entries()) {
      const square = Square(rawByte);

      if (Square.isEmpty(square)) continue;

      if (Square.isOccupiedByAnyPiece(square, PAWN, QUEEN, ROOK)) {
        return false;
      }

      if (Square.isOccupiedByAny(square, WHITE, BISHOP)) {
        wBishops++;
        wBishopPosition = Position(i);
      } else if (Square.isOccupiedByAny(square, WHITE, KNIGHT)) {
        wKnights++;
      } else if (Square.isOccupiedByAny(square, BLACK, BISHOP)) {
        bBishops++;
        bBishopPosition = Position(i);
      } else if (Square.isOccupiedByAny(square, BLACK, KNIGHT)) {
        bKnights++;
      }
    }

    const whiteKingOnly = wBishops === 0 && wKnights === 0;
    const blackKingOnly = bBishops === 0 && bKnights === 0;

    if (whiteKingOnly && blackKingOnly) return true;

    const whiteOneBishopBlackKing = wBishops === 1 && wKnights === 0 && blackKingOnly;
    const blackOneBishopWhiteKing = bBishops === 1 && bKnights === 0 && whiteKingOnly;
    if (whiteOneBishopBlackKing || blackOneBishopWhiteKing) return true;

    const whiteOneKnightBlackKing = wKnights === 1 && wBishops === 0 && blackKingOnly;
    const blackOneKnightWhiteKing = bKnights === 1 && bBishops === 0 && whiteKingOnly;
    if (whiteOneKnightBlackKing || blackOneKnightWhiteKing) return true;

    const bothHaveOneBishopOnly = wBishops === 1 && bBishops === 1 && wKnights === 0 && bKnights === 0;
    if (bothHaveOneBishopOnly) {
      return Position.isDarkSquare(wBishopPosition) === Position.isDarkSquare(bBishopPosition);
    }

    return false;
  }

  isCheckMate(ctx: TurnContext, engine: IEngine): boolean {
    if (engine.hasAnyLegalMoves(ctx)) return false;

    const current = ctx.sideToMove;
    const enemy = PieceColor.opponent(current);
    const kingPosition = MoveContext.sideOf(ctx, current).kingPosition;
    return engine.isSquareAttacked(kingPosition, enemy, ctx);
  }

  isStaleMate(ctx: TurnContext, engine: IEngine): boolean {
    if (engine.hasAnyLegalMoves(ctx)) return false;

    const current = ctx.sideToMove;
    const enemy = PieceColor.opponent(current);
    const kingPosition = MoveContext.sideOf(ctx, current).kingPosition;
    return !engine.isSquareAttacked(kingPosition, enemy, ctx);
  }

  getGameResult(
    ctx: TurnContext,
    engine: IEngine,
    tracker: ITracker,
    hash: bigint,
  ): GameResult {
    if (this.isFiftyMoveRule(ctx)) {
      return { status: DRAW, hasWinner: false, winner: WHITE, drawReason: FIFTY_MOVE_RULE };
    }

    if (this.isThreefoldRepetition(tracker, hash)) {
      return { status: DRAW, hasWinner: false, winner: WHITE, drawReason: THREEFOLD_REPETITION };
    }

    if (this.isInsufficientMaterial(ctx)) {
      return { status: DRAW, hasWinner: false, winner: WHITE, drawReason: INSUFFICIENT_MATERIAL };
    }

    if (engine.hasAnyLegalMoves(ctx)) {
      return { status: IN_PROGRESS, hasWinner: false, winner: WHITE, drawReason: NO_DRAW_REASON };
    }

    const current = ctx.sideToMove;
    const enemy = PieceColor.opponent(current);
    const kingPosition = MoveContext.sideOf(ctx, current).kingPosition;
    const kingInCheck = engine.isSquareAttacked(kingPosition, enemy, ctx);

    if (kingInCheck) {
      return { status: CHECKMATE, hasWinner: true, winner: enemy, drawReason: NO_DRAW_REASON };
    }

    return { status: DRAW, hasWinner: false, winner: WHITE, drawReason: STALEMATE };
  }
}

const defaultRules = new DefaultRules();

export function getDefaultRules(): IRules {
  return defaultRules;
}
