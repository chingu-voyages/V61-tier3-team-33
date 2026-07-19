import { Board, Square } from "../core/board";
import { BLACK, Piece, WHITE } from "../core/piece";
import { File, NO_POSITION, Position, Rank } from "../core/position";
import type { TurnContext } from "../core/state";
import { MoveContext } from "../core/state";

/**
 * Encodes the board into the first FEN field — piece placement.
 *
 * Iterates from rank 8 (top) down to rank 1 (bottom), left-to-right by file.
 * Each rank is a string of piece letters and digit-run empties; ranks are
 * joined by `'/'`.
 *
 * FEN piece letters: `P N B R Q K` (white) / `p n b r q k` (black).
 */
function encodePiecePlacement(ctx: TurnContext): string {
  const parts: string[] = [];

  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    let rank = "";

    for (let f = 0; f < 8; f++) {
      const position = Position.create(File(f), Rank(r));
      const square = Board.at(ctx.board, position);

      if (Square.isOccupied(square)) {
        // flush any accumulated empty count before the piece letter
        if (empty > 0) {
          rank += String(empty);
        }
        empty = 0;
        rank += Piece.toChar({
          type: Square.pieceType(square),
          color: Square.pieceColor(square),
        });
        continue;
      }

      empty++;
    }

    // trailing empty squares at the end of the rank
    if (empty > 0) {
      rank += String(empty);
    }

    parts.push(rank);
  }

  return parts.join("/");
}

/**
 * Encodes the side to move as the second FEN field — `'w'` or `'b'`.
 */
function encodeSideToMove(ctx: TurnContext): string {
  return ctx.sideToMove === WHITE ? "w" : "b";
}

/**
 * Encodes castling rights as the third FEN field.
 *
 * Up to four letters in the order `KQkq`, or `'-'` when neither side can
 * castle.  Only rights that are still available appear in the output.
 */
function encodeCastlingRights(ctx: TurnContext): string {
  let result = "";

  if (MoveContext.sideOf(ctx, WHITE).canCastleKingSide) result += "K";
  if (MoveContext.sideOf(ctx, WHITE).canCastleQueenSide) result += "Q";

  if (MoveContext.sideOf(ctx, BLACK).canCastleKingSide) result += "k";
  if (MoveContext.sideOf(ctx, BLACK).canCastleQueenSide) result += "q";

  return result || "-";
}

/**
 * Encodes the en-passant target square as the fourth FEN field.
 *
 * Returns the algebraic square (e.g. `"e3"`) or `'-'` when no en-passant
 * capture is available this ply.
 */
function encodeEnPassantTarget(ctx: TurnContext): string {
  if (ctx.enPassantTarget === NO_POSITION) {
    return "-";
  }

  const file = String.fromCharCode(Position.file(ctx.enPassantTarget) + 97);
  const rank = String.fromCharCode(Position.rank(ctx.enPassantTarget) + 49);
  return file + rank;
}

/**
 * Encodes the halfmove clock as the fifth FEN field — an unsigned decimal.
 */
function encodeHalfMoveClock(ctx: TurnContext): string {
  return String(ctx.halfMoveClock);
}

/**
 * Encodes the fullmove number as the sixth FEN field — an unsigned decimal.
 */
function encodeFullMoveNumber(ctx: TurnContext): string {
  return String(ctx.fullMoveNumber);
}

/**
 * Serialises a TurnContext into a standard six-field FEN string.
 *
 * The six fields in order:
 *   1. Piece placement (8 ranks, `/`-separated)
 *   2. Side to move (`w` / `b`)
 *   3. Castling rights (`KQkq` subset or `-`)
 *   4. En-passant target (algebraic square or `-`)
 *   5. Halfmove clock (decimal)
 *   6. Fullmove number (decimal)
 *
 * Encode and decodeFEN are inverses: `decodeFEN(encode(ctx))` reproduces
 * the same position.
 */
export function encodeFEN(ctx: TurnContext): string {
  const parts = [
    encodePiecePlacement(ctx),
    encodeSideToMove(ctx),
    encodeCastlingRights(ctx),
    encodeEnPassantTarget(ctx),
    encodeHalfMoveClock(ctx),
    encodeFullMoveNumber(ctx),
  ];

  return parts.join(" ");
}
