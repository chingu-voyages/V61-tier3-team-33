import type { Move } from "../core/move";
import type { TurnContext } from "../core/state";
import type { IEngine } from "../engine/engine";

import { PAWN } from "../core/piece";
import { CASTLING, PROMOTION, EN_PASSANT } from "../core/move";
import { Position, File, Rank } from "../core/position";
import { getDefaultEngine } from "../engine/default";

const PIECE_LETTERS = ["", "N", "B", "R", "Q", "K"] as const;

/** Lowercase file letter, e.g. `"e"`. `File.toString` is uppercase (FEN style), so SAN lowercases it. */
function fileChar(position: Position): string {
  return File.toString(Position.file(position)).toLowerCase();
}

/** Rank digit, e.g. `"4"`. */
function rankChar(position: Position): string {
  return Rank.toString(Position.rank(position));
}

/** `"#"` for checkmate, `"+"` for check, `""` otherwise. */
function suffix(isCheck: boolean, isCheckmate: boolean): string {
  if (isCheckmate) return "#";
  if (isCheck) return "+";
  return "";
}

/**
 * Encodes a `Move` + its context into Standard Algebraic Notation.
 *
 *   Nf3, exd5, O-O, e8=Q+, Qxh7#
 *
 * `encode` takes a `Move`, the **pre-move** `TurnContext` (for
 * disambiguation — which other pieces could reach the same square),
 * and check/checkmate booleans (which require the **post-move** position
 * to determine).
 *
 * Decode is not yet implemented — it requires parsing SAN back into a
 * `Move`, which is a more complex operation (reverse-disambiguation).
 */
export interface ISan {
  /**
   * @param move - The move to encode.
   * @param ctx - The **pre-move** TurnContext (for disambiguation).
   * @param isCheck - True if the move puts the opponent in check.
   * @param isCheckmate - True if the move is checkmate.
   * @returns The SAN string.
   */
  encode(
    move: Move,
    ctx: TurnContext,
    isCheck: boolean,
    isCheckmate: boolean,
  ): string;
}

/**
 * SAN (Standard Algebraic Notation) encoder, backed by an `IEngine` for
 * move disambiguation. Defaults to the shared `getDefaultEngine()` singleton
 * so callers don't need to thread an engine through every call — pass one
 * explicitly only if you're using a non-default `IEngine`.
 */
export class San implements ISan {
  constructor(private readonly engine: IEngine = getDefaultEngine()) {}

  encode(
    move: Move,
    ctx: TurnContext,
    isCheck: boolean,
    isCheckmate: boolean,
  ): string {
    // Castling has its own notation and skips everything below (piece
    // letter, disambiguation, capture/destination, promotion).
    if (move.type === CASTLING) {
      // King moves toward the h-file for kingside, a-file for queenside.
      const base =
        Position.file(move.to) > Position.file(move.from) ? "O-O" : "O-O-O";
      return base + suffix(isCheck, isCheckmate);
    }

    let san = "";

    // Piece letter (empty for pawns)
    san += move.piece.type === PAWN ? "" : PIECE_LETTERS[move.piece.type];

    // Disambiguation (not for pawns)
    san += this.disambiguation(move, ctx);

    // Capture indicator
    const isCapture = move.captured !== null || move.type === EN_PASSANT;
    if (isCapture) {
      // Pawns always show their origin file on captures: exd5
      if (move.piece.type === PAWN) {
        san += fileChar(move.from);
      }
      san += "x";
    }

    // Destination square
    san += fileChar(move.to) + rankChar(move.to);

    // Promotion
    if (move.type === PROMOTION && move.promoteTo !== null) {
      san += "=" + PIECE_LETTERS[move.promoteTo];
    }

    // Check / checkmate suffix
    san += suffix(isCheck, isCheckmate);

    return san;
  }

  /**
   * Determines the minimal disambiguation string for a move.
   *
   * PGN rules: if two or more pieces of the same type can legally move to
   * the same square, disambiguate by file. If they share a file, use rank.
   * If they share both (rare), use the full square.
   */
  private disambiguation(move: Move, ctx: TurnContext): string {
    // Pawns never need piece-letter disambiguation; their file is always
    // shown on captures. Castling's king is the only piece that can castle.
    if (move.piece.type === PAWN || move.type === CASTLING) return "";

    const ambiguous = this.findAmbiguousPieces(move, ctx);
    if (ambiguous.length === 0) return "";

    const sameFile = ambiguous.some(
      (p) => Position.file(p) === Position.file(move.from),
    );
    const sameRank = ambiguous.some(
      (p) => Position.rank(p) === Position.rank(move.from),
    );

    if (!sameFile) {
      // No other ambiguous piece shares our file — file letter alone disambiguates.
      return fileChar(move.from);
    }
    if (!sameRank) {
      // Files clash but ranks don't — rank digit alone disambiguates.
      return rankChar(move.from);
    }
    // Both file and rank are shared with some ambiguous piece (e.g. three
    // queens on the same file/rank cross) — fall back to the full square.
    return fileChar(move.from) + rankChar(move.from);
  }

  /**
   * Finds every other piece of the same type+color that has a *legal* move
   * to `move.to`. Used for SAN disambiguation. Delegates to the engine's
   * legal-move generator, so pins and checks are accounted for correctly —
   * a pinned piece that can't actually reach the square won't force an
   * unnecessary disambiguator.
   */
  private findAmbiguousPieces(move: Move, ctx: TurnContext): Position[] {
    const ambiguous: Position[] = [];
    const buffer: Move[] = [];

    for (let pos = 0; pos < 64; pos++) {
      if (pos === move.from) continue;

      const from = pos as Position;
      buffer.length = 0;
      const legal = this.engine.getLegalMoves(buffer, from, ctx);

      const sameTypeAndTarget = legal.some(
        (m) => m.piece.type === move.piece.type && m.to === move.to,
      );
      if (sameTypeAndTarget) ambiguous.push(from);
    }

    return ambiguous;
  }
}

/** Default SAN encoder, backed by `getDefaultEngine()`. */
export const SAN: ISan = new San();
