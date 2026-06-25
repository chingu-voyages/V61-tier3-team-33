import type { TurnContext } from "../core/state";
import type { MoveHash } from "../core/hash";

/**
 * Computes incremental Zobrist hashes for position identity.
 *
 * Zobrist hashing fingerprints a board position: each piece-on-square,
 * castling right, en passant file, and side-to-move contributes a random
 * constant combined with XOR.  Because XOR is its own inverse, the same
 * operation both applies and reverts a change — `hash()` can be called
 * identically after Apply or before Undo.  `initHash()` computes the full
 * hash from scratch (e.g. after a FEN decode); `hash()` then updates it
 * incrementally for every subsequent move.
 *
 * Hashes are 64-bit unsigned integers represented as `bigint`.  JavaScript's
 * `number` type can only represent integers exactly up to 2^53 − 1, so a
 * true uint64 key space requires `bigint`.
 */
export interface IHasher {
  /**
   * Computes the full hash from scratch for the given context.
   * Call this once to bootstrap (e.g. after FEN decode), then use `hash()`
   * for every subsequent Apply/Undo.
   */
  initHash(ctx: TurnContext): bigint;

  /**
   * Updates `current` by XOR-ing out the facts that became false and XOR-ing
   * in the facts that became true, as described by `move`.
   * Call after Apply to advance the hash, or before Undo to revert it —
   * the result is identical either way.
   */
  hash(current: bigint, move: MoveHash): bigint;
}
