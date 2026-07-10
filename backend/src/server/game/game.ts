import { Chess } from "../../chess";
import { IllegalMoveError, NothingToUndoError } from "../../chess/errors";
import type { Move } from "../../chess/core/move";

import {
  WHITE,
  BLACK,
  WAITING,
  ACTIVE,
  FINISHED,
  RULES,
  ABANDONED,
  RESIGNATION,
  TIMEOUT,
  IN_PROGRESS,
  NO_DRAW_REASON,
  type EndReason,
  type GameOutcome,
  type GameSnapshot,
  type Lifecycle,
  type MoveInput,
  type Mode,
  type PieceColor,
  type PieceType,
  type Position,
} from "../types";

import {
  ok,
  err,
  NOT_YOUR_TURN,
  ILLEGAL_MOVE,
  GAME_OVER,
  SQUARE_EMPTY,
  NO_HISTORY,
  ROOM_FULL,
  INVALID_MODE,
  SELECT_GAME_OVER,
  SELECT_NOT_YOUR_TURN,
  SELECT_SQUARE_EMPTY,
  SELECT_NOT_YOUR_PIECE,
  type Result,
  type MoveError,
  type UndoError,
  type JoinError,
  type SelectError,
} from "../types";

import type { Occupant } from "../occupant/occupant";
import type { Publisher, Subscriber } from "../bus/bus";
import { FAST } from "../bus/bus";
import { Mutex } from "../util/mutex";
import type { Clock } from "../clock/clock";
import type { Timer } from "../clock/timer";

import {
  Notifications,
  CLOCK_EXPIRED,
  type Notification,
} from "../protocol/events";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Game" });

/** A single chess match: two color slots, one engine, one lifecycle. */
export class Game {
  status: Lifecycle = WAITING;
  endReason: EndReason | null = null;
  readonly createdAt: number = Date.now();
  finishedAt: number | null = null;

  private chess: Chess = new Chess();
  private slots = new Map<PieceColor, Occupant>();
  private lock = new Mutex();
  private abandonedBy: PieceColor | null = null;

  constructor(
    readonly id: string,
    readonly mode: Mode,
    readonly clock: Clock,
    private publisher: Publisher & Subscriber,
    readonly timer: Timer,
    private onActivated?: () => void,
  ) {
    log.info("[GAME-create]", { id, mode: mode.toString(), format: this.clock.format, initialMs: this.clock.initialMs });
    this.setup();
  }

  private setup(): void {
    this.publisher.on(
      CLOCK_EXPIRED,
      (_roomId, event) => {
        if (event.type === CLOCK_EXPIRED) {
          this.expire();
        }
      },
      FAST,
    );
  }

  get isEmpty(): boolean {
    return this.slots.size === 0;
  }

  /** True once both color slots are filled. */
  get isFull(): boolean {
    return this.slots.size >= 2;
  }

  get isWaiting(): boolean {
    return this.status === WAITING;
  }

  get isActive(): boolean {
    return this.status === ACTIVE;
  }

  /** True once the game has ended, for any reason. */
  get isFinished(): boolean {
    return this.status === FINISHED;
  }

  /** The color a new joiner would take, or null if the game is already full. */
  nextColor(): PieceColor | null {
    if (this.isFull) return null;
    return this.slots.has(WHITE) ? BLACK : WHITE;
  }

  /** The occupant in a color slot, or null if that slot is empty. */
  getOccupant(color: PieceColor): Occupant | null {
    return this.slots.get(color) ?? null;
  }

  /** The player id in a color slot, or null if that slot is empty. */
  playerIdByColor(color: PieceColor): string | null {
    return this.slots.get(color)?.playerId ?? null;
  }

  /** Removes the occupant from a color slot and broadcasts room:left. */
  leave(color: PieceColor): void {
    log.info("[GAME-leave]", { id: this.id, color, occupant: this.slots.get(color)?.playerId });
    this.broadcast(Notifications.roomLeft(this.id, color));
    this.slots.delete(color);
    log.info("[GAME-leave-done]", { id: this.id, slotsRemaining: this.slots.size });
  }

  /**
   * Replaces whatever occupant is in `color`'s slot with `occupant`,
   * returning whoever was seated there before (null if the slot was empty).
   * Callers can use the returned occupant to preserve reconnect-relevant
   * state (see `Human.replaceSocket`) instead of building a fresh one.
   */
  reseat(color: PieceColor, occupant: Occupant): Occupant | null {
    const previous = this.slots.get(color) ?? null;
    log.info("[GAME-reseat]", { id: this.id, color, newPlayerId: occupant.playerId, previousPlayerId: previous?.playerId ?? null });
    this.slots.set(color, occupant);
    return previous;
  }

  /** Delivers `event` to every seated occupant, and once to the Hub. */
  broadcast(event: Notification): void {
    this.publisher.emit(event);
    for (const occupant of this.slots.values()) {
      occupant.notify(event);
    }
  }

  /**
   * Delivers `event` to `color`'s occupant only, but still emits it to the
   * Hub — so single-target replies (e.g. a rejected move) stay visible to
   * spectators/logging, not just room-wide broadcasts.
   */
  notify(color: PieceColor, event: Notification): void {
    this.publisher.emit(event);
    this.slots.get(color)?.notify(event);
  }

  /** Seats an occupant into a color slot; the game goes ACTIVE once both are filled. */
  join(color: PieceColor, occupant: Occupant): Result<void, JoinError> {
    log.info("[GAME-join]", { id: this.id, color, playerId: occupant.playerId, status: this.status, slotsBefore: this.slots.size });
    if (this.status === FINISHED) {
      log.warn("[GAME-join-reject-finished]", { id: this.id, color });
      return err(INVALID_MODE);
    }
    if (this.slots.has(color)) {
      log.warn("[GAME-join-reject-full]", { id: this.id, color, occupant: this.slots.get(color)?.playerId });
      return err(ROOM_FULL);
    }

    this.slots.set(color, occupant);
    if (this.isFull) {
      this.status = ACTIVE;
      log.info("[GAME-activated]", { id: this.id, white: this.slots.get(WHITE)?.playerId, black: this.slots.get(BLACK)?.playerId });
      this.timer.start(this.clock.initialMs, this.clock.initialMs, WHITE);
      this.onActivated?.();
    } else {
      log.info("[GAME-join-waiting]", { id: this.id, color, slotsNow: this.slots.size, nextColor: this.nextColor() });
    }

    return ok();
  }

  /**
   * Returns the legal destination squares for the piece on `position`,
   * assuming `color` is the one attempting the selection. Read-only — it
   * doesn't touch history/hash, so unlike move()/undo() it isn't run
   * through the mutex; there's no mutation for a concurrent call to race.
   * Caller (GameService) turns the result into position:accept/reject.
   */
  selectPosition(
    color: PieceColor,
    position: Position,
  ): Result<Position[], SelectError> {
    if (this.status !== ACTIVE) return err(SELECT_GAME_OVER);
    if (this.chess.sideToMove() !== color) return err(SELECT_NOT_YOUR_TURN);

    const piece = this.chess.pieceAt(position);
    if (piece === null) return err(SELECT_SQUARE_EMPTY);
    if (piece.color !== color) return err(SELECT_NOT_YOUR_PIECE);

    // Dedupe: a pawn one step from promotion has one legal move per
    // promoteTo piece type, all sharing the same `to` square.
    const destinations = new Set<Position>();
    for (const move of this.chess.legalMovesFrom(position)) {
      destinations.add(move.to);
    }

    return ok([...destinations]);
  }

  /** Applies a move as `color`. The caller broadcasts MOVE_MADE on success. */
  async move(
    color: PieceColor,
    input: MoveInput,
  ): Promise<Result<Move, MoveError>> {
    return this.lock.run(async () => {
      if (this.status !== ACTIVE) {
        log.warn("[GAME-move-reject-not-active]", { id: this.id, color, from: input.from, to: input.to, status: this.status });
        return err(GAME_OVER);
      }
      if (this.chess.sideToMove() !== color) {
        log.warn("[GAME-move-reject-turn]", { id: this.id, color, from: input.from, to: input.to, expectedTurn: this.chess.sideToMove() });
        return err(NOT_YOUR_TURN);
      }
      if (this.chess.isOver()) {
        log.warn("[GAME-move-reject-over]", { id: this.id, color });
        return err(GAME_OVER);
      }
      if (this.chess.pieceAt(input.from) === null) {
        log.warn("[GAME-move-reject-empty]", { id: this.id, color, from: input.from });
        return err(SQUARE_EMPTY);
      }

      try {
        this.timer.stop(color);
        log.info("[GAME-move-executing]", { id: this.id, color, from: input.from, to: input.to });
        const applied = this.chess.move(input.from, input.to, input.promoteTo);
        this.settleIfOver();

        if (this.status === ACTIVE) {
          const opponent = color === WHITE ? BLACK : WHITE;
          this.timer.startNext(opponent);
        }

        log.info("[GAME-move-success]", { id: this.id, color, san: applied.san, status: this.status });
        return ok(applied);
      } catch (e) {
        if (e instanceof IllegalMoveError) {
          log.warn("[GAME-move-illegal]", { id: this.id, color, from: input.from, to: input.to });
          return err(ILLEGAL_MOVE);
        }
        log.error("[GAME-move-exception]", { id: this.id, color, error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    });
  }

  /**
   * Ends the game immediately as a resignation by `color`. Caller
   * broadcasts GAME_ENDED on success.
   */
  async resign(by: PieceColor): Promise<Result<GameOutcome, MoveError>> {
    return this.lock.run(async () => {
      if (this.status !== ACTIVE) {
        log.warn("[GAME-resign-reject]", { id: this.id, by, status: this.status });
        return err(GAME_OVER);
      }

      this.timer.dispose();
      const winner = by === WHITE ? BLACK : WHITE;
      this.status = FINISHED;
      this.endReason = RESIGNATION;
      this.finishedAt = Date.now();

      log.info("[GAME-resigned]", { id: this.id, by, winner });

      const outcome: GameOutcome = {
        status: this.chess.gameResult().status,
        winner,
        hasWinner: true,
        drawReason: NO_DRAW_REASON,
        reason: RESIGNATION,
      };

      return ok(outcome);
    });
  }

  /**
   * Ends the game due to abandonment by `color` (grace period expired).
   * No-op if already finished. Like `expire`, broadcasts internally.
   */
  async abandon(by: PieceColor): Promise<void> {
    return this.lock.run(async () => {
      if (this.status !== ACTIVE) {
        log.warn("[GAME-abandon-skip]", { id: this.id, by, status: this.status });
        return;
      }

      this.timer.dispose();
      this.abandonedBy = by;
      this.status = FINISHED;
      this.endReason = ABANDONED;
      this.finishedAt = Date.now();

      log.info("[GAME-abandoned]", { id: this.id, by, winner: by === WHITE ? BLACK : WHITE });

      const outcome = this.outcome();
      this.broadcast(Notifications.gameEnded(this.id, outcome, outcome.winner));
    });
  }

  /** Called internally when the timer emits CLOCK_EXPIRED. Safe to call multiple times. */
  expire(): void {
    if (this.status !== ACTIVE) {
      log.warn("[GAME-expire-skip]", { id: this.id, status: this.status });
      return;
    }
    this.timer.dispose();
    this.status = FINISHED;
    this.endReason = TIMEOUT;
    this.finishedAt = Date.now();

    const expiredColor = this.chess.sideToMove();

    log.info("[GAME-expired]", { id: this.id, expiredColor, winner: expiredColor === WHITE ? BLACK : WHITE });

    this.broadcast(Notifications.clockExpired(this.id, expiredColor));

    const result = this.outcome();
    this.broadcast(Notifications.gameEnded(this.id, result, result.winner));
  }

  /** Undoes the last move, reopening the game if it had just finished. */
  async undo(): Promise<Result<Move, UndoError>> {
    return this.lock.run(async () => {
      if (this.status === WAITING) {
        log.warn("[GAME-undo-no-history]", { id: this.id, status: this.status });
        return err(NO_HISTORY);
      }

      try {
        const undone = this.chess.undoMove();
        const wasFinished = this.status === FINISHED;
        if (wasFinished) {
          this.status = ACTIVE;
          this.finishedAt = null;
        }

        log.info("[GAME-undo-success]", { id: this.id, reopened: wasFinished, san: undone.san });
        return ok(undone);
      } catch (e) {
        if (e instanceof NothingToUndoError) {
          log.warn("[GAME-undo-nothing]", { id: this.id });
          return err(NO_HISTORY);
        }
        log.error("[GAME-undo-exception]", { id: this.id, error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    });
  }

  /** A full, serializable view of the current position — for join/sync/undo. */
  snapshot(): GameSnapshot {
    const history = this.chess.moveHistory();
    const { capturedByWhite, capturedByBlack } = this.splitCaptures(history);
    const outcome = this.outcome();

    return {
      status: this.status,
      fen: this.chess.toFen(),
      turn: this.chess.sideToMove(),
      isCheck: this.chess.isInCheck(),
      resultStatus: outcome.status,
      winner: outcome.winner,
      hasWinner: outcome.hasWinner,
      drawReason: outcome.drawReason,
      endReason: outcome.reason,
      history: history.map((m) => m.san ?? ""),
      capturedByWhite,
      capturedByBlack,
      clock: this.timer.state,
    };
  }

  /**
   * If the engine now reports the game as over, marks this game FINISHED
   * and returns the resulting outcome. Returns null while still in progress.
   */
  private settleIfOver(): GameOutcome | null {
    const engineResult = this.chess.gameResult();
    if (engineResult.status === IN_PROGRESS) return null;

    this.status = FINISHED;
    this.endReason = RULES;
    this.finishedAt = Date.now();

    return this.outcome(engineResult);
  }

  /** The current outcome, built from a given (or freshly-fetched) engine result. */
  private outcome(engineResult = this.chess.gameResult()): GameOutcome {
    if (this.endReason === TIMEOUT) {
      const expiredSide = this.chess.sideToMove();
      const winner = expiredSide === WHITE ? BLACK : WHITE;
      return {
        status: IN_PROGRESS,
        winner,
        hasWinner: true,
        drawReason: NO_DRAW_REASON,
        reason: TIMEOUT,
      };
    }

    if (this.endReason === ABANDONED && this.abandonedBy !== null) {
      const winner = this.abandonedBy === WHITE ? BLACK : WHITE;
      const hasOpponent = this.slots.has(winner);
      return {
        status: IN_PROGRESS,
        winner: hasOpponent ? winner : WHITE,
        hasWinner: hasOpponent,
        drawReason: NO_DRAW_REASON,
        reason: ABANDONED,
      };
    }

    return {
      status: engineResult.status,
      winner: engineResult.winner,
      hasWinner: engineResult.hasWinner,
      drawReason: engineResult.drawReason,
      reason: this.endReason ?? RULES,
    };
  }

  /** Splits captured pieces out of move history by which color captured them. */
  private splitCaptures(history: readonly Move[]): {
    capturedByWhite: PieceType[];
    capturedByBlack: PieceType[];
  } {
    const capturedByWhite: PieceType[] = [];
    const capturedByBlack: PieceType[] = [];

    for (const m of history) {
      if (!m.captured) continue;
      (m.piece.color === WHITE ? capturedByWhite : capturedByBlack).push(
        m.captured.type,
      );
    }

    return { capturedByWhite, capturedByBlack };
  }
}
