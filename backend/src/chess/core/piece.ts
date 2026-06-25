import type { Brand } from "./brand";
import type { Rank } from "./position";

import { RANK_1, RANK_8 } from "./position";

/** One of the 6 chess piece types (0–5). */
export type PieceType = Brand<number, "PieceType">;

export const PieceType = (value: number): PieceType => value as PieceType;

export const PAWN: PieceType = PieceType(0);
export const KNIGHT: PieceType = PieceType(1);
export const BISHOP: PieceType = PieceType(2);
export const ROOK: PieceType = PieceType(3);
export const QUEEN: PieceType = PieceType(4);
export const KING: PieceType = PieceType(5);

/** Side to move or piece ownership (0 = white, 1 = black). */
export type PieceColor = Brand<number, "PieceColor">;

export const PieceColor = Object.assign(
  (value: number): PieceColor => value as PieceColor,
  {
    /** Returns the opponent's color. */
    opponent(color: PieceColor): PieceColor {
      return color === WHITE ? BLACK : WHITE;
    },

    /** Returns the back rank index for the given color (white → 0, black → 7). */
    kingStartRank(color: PieceColor): Rank {
      return color === WHITE ? RANK_1 : RANK_8;
    },
  },
);

export const WHITE: PieceColor = PieceColor(0);
export const BLACK: PieceColor = PieceColor(1);

/** A piece's type and color together. */
export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export const Piece = {
  /** Returns the FEN character: uppercase for white, lowercase for black. */
  toChar(piece: Piece): string {
    const letters = ["P", "N", "B", "R", "Q", "K"];
    const c = letters[piece.type]!;
    if (piece.color === BLACK) {
      return c.toLowerCase();
    }
    return c;
  },

  /**
   * Parses a single FEN character into a Piece.
   *
   * @param letter - Must be exactly one character. Accepts `'P' 'N' 'B' 'R' 'Q' 'K'`
   *   (white) or `'p' 'n' 'b' 'r' 'q' 'k'` (black). Any other character or a
   *   multi-character string returns `null`.
   * @returns The corresponding Piece, or `null` if the input is invalid.
   */
  parse(letter: string): Piece | null {
    if (letter.length !== 1) return null;
    const upper = letter.toUpperCase();
    const type = "PNBRQK".indexOf(upper);
    if (type === -1) {
      return null;
    }
    const color = letter === upper ? WHITE : BLACK;
    return { type: PieceType(type), color };
  },
};
