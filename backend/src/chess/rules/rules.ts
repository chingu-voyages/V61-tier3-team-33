import type { TurnContext } from "../core/state";
import type { IEngine } from "../engine/engine";
import type { ITracker } from "../tracker/tracker";
import type { GameResult } from "../core/game";

/**
 * Evaluates chess game-ending conditions and produces a GameResult after each move.
 * Implementations must be pure: every method is stateless and
 * synchronous — no side effects, no knowledge of the game orchestrator.
 *
 * # Evaluation order
 *
 * `getGameResult` short-circuits from cheapest to most expensive:
 *
 *  1. `isFiftyMoveRule`        — O(1)  single integer comparison
 *  2. `isThreefoldRepetition`  — O(1)  single map lookup
 *  3. `isInsufficientMaterial` — O(64) one pass over the board
 *  4. `hasAnyLegalMoves`       — O(n)  pseudo-legal generation + king-safety filter
 *     called at most once per result check;
 *     if false → `isSquareAttacked` on the king
 *     determines checkmate vs stalemate.
 *
 * The individual `isCheckMate` and `isStaleMate` methods each call
 * `hasAnyLegalMoves` internally. Never call both back-to-back — use
 * `getGameResult` instead, which fuses them into a single call.
 *
 * # Dependency contract
 *
 * Each method receives only the data it actually reads:
 *
 *   `isFiftyMoveRule`          → ctx.halfMoveClock
 *   `isThreefoldRepetition`    → tracker, hash
 *   `isInsufficientMaterial`   → ctx.board
 *   `isCheckMate`/`isStaleMate`→ ctx, engine
 *   `getGameResult`            → all of the above
 */
export interface IRules {
  /**
   * Returns true when `ctx.halfMoveClock` has reached 100 half-moves
   * (50 full moves) without a pawn push or capture.
   */
  isFiftyMoveRule(ctx: TurnContext): boolean;

  /**
   * Returns true when the current position has occurred at least three times.
   * Delegates to `tracker.count(hash)`. O(1) — single map lookup.
   */
  isThreefoldRepetition(tracker: ITracker, hash: bigint): boolean;

  /**
   * Returns true when neither side has enough material to force checkmate.
   * The following combinations are drawn:
   *
   *   K vs K
   *   K + N vs K
   *   K + B vs K
   *   K + B vs K + B  (only when both bishops share the same square color)
   *
   * Any pawn, rook, or queen on the board means material is sufficient.
   */
  isInsufficientMaterial(ctx: TurnContext): boolean;

  /**
   * Returns true when the side to move is in checkmate: their king is in
   * check and they have no legal move to escape it.
   *
   * Prefer `getGameResult` when you need a full evaluation — it fuses this
   * check with `isStaleMate` to avoid a redundant `hasAnyLegalMoves` call.
   */
  isCheckMate(ctx: TurnContext, engine: IEngine): boolean;

  /**
   * Returns true when the side to move is in stalemate: they have no legal
   * move but their king is not in check.
   *
   * Prefer `getGameResult` when you need a full evaluation — it fuses this
   * check with `isCheckMate` to avoid a redundant `hasAnyLegalMoves` call.
   */
  isStaleMate(ctx: TurnContext, engine: IEngine): boolean;

  /**
   * Evaluates all termination conditions in cheapest-first order and returns
   * the current game result. Call this after every move.
   *
   * Returns a `GameResult` with `status === IN_PROGRESS` when the game
   * continues. When the game is over, `status` is either `CHECKMATE` or
   * `DRAW`; a draw carries a `drawReason` identifying which rule triggered.
   *
   * `hasAnyLegalMoves` is called at most once regardless of how many
   * conditions are checked.
   */
  getGameResult(
    ctx: TurnContext,
    engine: IEngine,
    tracker: ITracker,
    hash: bigint,
  ): GameResult;
}
