import type { TurnContext } from "../core/state";
import type { FENError } from "../errors";

/**
 * Converts between a chess notation format string and a TurnContext that the
 * engine can work with. Decode and Encode are inverses: `encode(decode(s))`
 * should round-trip to the same string.
 *
 * Currently supported:
 *   - FEN (Forsyth-Edwards Notation) — the standard chess position format.
 */
export interface IParser {
  /**
   * Parses a notation string into a fresh TurnContext.
   * Returns `[ctx, null]` on success, or `[null, FENError]` on failure.
   */
  decode(str: string): [TurnContext, null] | [null, FENError];

  /**
   * Parses a notation string into an existing TurnContext.
   * Returns `null` on success, or an error message on failure.
   */
  decode(str: string, ctx: TurnContext): string | null;

  /** Serializes a TurnContext into a standard notation string. */
  encode(ctx: TurnContext): string;
}
