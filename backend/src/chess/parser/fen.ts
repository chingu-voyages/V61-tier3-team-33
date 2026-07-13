import type { TurnContext } from "../core/state";
import { TurnContext as TC } from "../core/state";
import { FENError } from "../errors";
import { decodeFEN } from "./decode";
import { encodeFEN } from "./encode";
import type { IParser } from "./parser";

/**
 * FEN (Forsyth-Edwards Notation) — the standard chess position format.
 *
 * Describes a chess position in a single line of ASCII text with six
 * space-separated fields:
 *
 *   <piece-placement> <side-to-move> <castling-rights> <en-passant-target>
 *   <halfmove-clock> <fullmove-number>
 *
 * Example:
 *   rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
 *
 * Decode and encode are inverses: `encode(decode(str))` reproduces
 * the same position.
 */
export class FEN implements IParser {
  decode(str: string): [TurnContext, null] | [null, FENError];
  decode(str: string, ctx: TurnContext): string | null;
  decode(str: string, ctx?: TurnContext): [TurnContext, null] | [null, FENError] | string | null {
    if (ctx !== undefined) {
      return decodeFEN(str, ctx);
    }

    const decoded = TC.create();
    const err = decodeFEN(str, decoded);
    if (err !== null) {
      return [null, new FENError(err)];
    }
    return [decoded, null];
  }

  encode(ctx: TurnContext): string {
    return encodeFEN(ctx);
  }
}
