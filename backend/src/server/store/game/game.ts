import { Chess } from "../../../chess";
import type { Move } from "../../../chess/core/move";
import { IllegalMoveError, NothingToUndoError } from "../../../chess/errors";
import { logger as rootLogger } from "../../../logging/logger";
import type { Clock } from "../../clock/clock";
import type { Timer } from "../../clock/timer";
import type { Publisher } from "../../events/hub";
import type { Occupant } from "../../occupant/occupant";
import { type Notification, Notifications } from "../../protocol/events";
import {
  ABANDONED,
  ACTIVE,
  BLACK,
  type EndReason,
  FINISHED,
  type GameOutcome,
  type GameSnapshot,
  IN_PROGRESS,
  type Lifecycle,
  type Mode,
  type MoveInput,
  NO_DRAW_REASON,
  type PieceColor,
  type PieceType,
  type Position,
  RESIGNATION,
  RULES,
  TIMEOUT,
  WAITING,
  WHITE,
} from "../../types";
import {
  err,
  GAME_OVER,
  type GameError,
  ILLEGAL_MOVE,
  INVALID_MODE,
  NO_HISTORY,
  NOT_ALLOWED,
  NOT_YOUR_PIECE,
  NOT_YOUR_TURN,
  ok,
  type Result,
  ROOM_FULL,
  type RoomError,
  SQUARE_EMPTY,
} from "../../types";
import { Mutex } from "../../util/mutex";

const log = rootLogger.child({ module: "Game" });

export class Game {
  status: Lifecycle = WAITING;
  endReason: EndReason | null = null;
  readonly createdAt: number = Date.now();
  finishedAt: number | null = null;
  moveSeq: number = 0;

  private chess: Chess = new Chess();
  private slots = new Map<PieceColor, Occupant>();
  private lock = new Mutex();
  private abandonedBy: PieceColor | null = null;

  constructor(
    readonly id: string,
    readonly mode: Mode,
    readonly clock: Clock,
    private publisher: Publisher,
    readonly timer: Timer,
    private onActivated?: () => void,
  ) {
    log.info("[Game.constructor:created]", {
      id,
      mode: mode.toString(),
      format: this.clock.format,
      initialMs: this.clock.initialMs,
    });
  }

  get isEmpty(): boolean {
    return this.slots.size === 0;
  }
  get isFull(): boolean {
    return this.slots.size >= 2;
  }
  get isWaiting(): boolean {
    return this.status === WAITING;
  }
  get isActive(): boolean {
    return this.status === ACTIVE;
  }
  get isFinished(): boolean {
    return this.status === FINISHED;
  }
  get turn(): PieceColor {
    return this.chess.sideToMove();
  }

  // True if undo has history and the game didn't end via resign/timeout/abandon
  // (those endings aren't tied to the last move, so undoing would rewind the wrong thing)
  get canUndo(): boolean {
    if (this.chess.moveHistory().length === 0) return false;
    if (this.status === FINISHED && this.endReason !== RULES) return false;
    return true;
  }

  /** Return the colour for the next joining player, or null if the game is full. */
  nextColor(): PieceColor | null {
    log.info("[Game.nextColor:start]", { id: this.id });
    if (this.isFull) return null;
    return this.slots.has(WHITE) ? BLACK : WHITE;
  }

  /** Return the occupant for the given colour, or null if the slot is empty. */
  getOccupant(color: PieceColor): Occupant | null {
    log.info("[Game.getOccupant:start]", { id: this.id, color });
    return this.slots.get(color) ?? null;
  }

  /** Return the player id for the given colour, or null if the slot is empty. */
  playerIdByColor(color: PieceColor): string | null {
    return this.slots.get(color)?.playerId ?? null;
  }

  /** Remove the occupant from the given slot and notify listeners. */
  leave(color: PieceColor): void {
    log.info("[Game.leave:start]", { id: this.id, color, occupant: this.slots.get(color)?.playerId });
    this.broadcast(Notifications.roomLeft(this.id, color));
    this.slots.delete(color);
    log.info("[Game.leave:done]", { id: this.id, slotsRemaining: this.slots.size });
  }

  /** Replace the occupant in the given slot. Returns the previous occupant, or null if the slot was empty. */
  reseat(color: PieceColor, occupant: Occupant): Occupant | null {
    const previous = this.slots.get(color) ?? null;
    log.info("[Game.reseat:start]", {
      id: this.id,
      color,
      newPlayerId: occupant.playerId,
      previousPlayerId: previous?.playerId ?? null,
    });
    this.slots.set(color, occupant);
    return previous;
  }

  /** Emit an event to the hub and to every occupant (broadcast). */
  broadcast(event: Notification): void {
    log.info("[Game.broadcast:start]", { id: this.id, event: event.type });
    this.publisher.emit(event);
    for (const occupant of this.slots.values()) occupant.notify(event);
  }

  /** Emit an event to the hub and to the occupant of the given slot (single-target). */
  notify(color: PieceColor, event: Notification): void {
    log.info("[Game.notify:start]", { id: this.id, color, event: event.type });
    this.publisher.emit(event);
    this.slots.get(color)?.notify(event);
  }

  /** Add an occupant to the given slot. Fails if the game is finished or the slot is taken. */
  join(color: PieceColor, occupant: Occupant): Result<void, RoomError> {
    log.info("[Game.join:start]", {
      id: this.id,
      color,
      playerId: occupant.playerId,
      status: this.status,
      slotsBefore: this.slots.size,
    });

    // reject if game is already finished or colour is taken
    if (this.status === FINISHED) {
      return err(INVALID_MODE);
    }
    if (this.slots.has(color)) {
      return err(ROOM_FULL);
    }

    // assign slot; start the clock when both players are seated
    this.slots.set(color, occupant);
    if (this.isFull) {
      this.status = ACTIVE;
      this.timer.start(this.clock.initialMs, this.clock.initialMs, WHITE);
      this.onActivated?.();
    }

    return ok();
  }

  /** Compute legal destinations for the piece at the given position. Read-only, no mutex. */
  selectPosition(color: PieceColor, position: Position): Result<Position[], GameError> {
    log.info("[Game.selectPosition:start]", { id: this.id, color, position });

    // validate turn and piece ownership
    if (this.status !== ACTIVE) {
      return err(GAME_OVER);
    }
    if (this.chess.sideToMove() !== color) {
      return err(NOT_YOUR_TURN);
    }

    const piece = this.chess.pieceAt(position);
    if (piece === null) {
      return err(SQUARE_EMPTY);
    }
    if (piece.color !== color) {
      return err(NOT_YOUR_PIECE);
    }

    // collect legal move destinations
    const destinations = new Set<Position>();
    for (const move of this.chess.legalMovesFrom(position)) {
      destinations.add(move.to);
    }

    log.info("[Game.selectPosition:accepted]", { id: this.id, color, position, moves: destinations.size });
    return ok([...destinations]);
  }

  /** Apply a move. Mutex-guarded to prevent concurrent board mutations. */
  async move(color: PieceColor, input: MoveInput): Promise<Result<Move, GameError>> {
    return this.lock.run(async () => {
      // validate turn and board state
      if (this.status !== ACTIVE) {
        return err(GAME_OVER);
      }
      if (this.chess.sideToMove() !== color) {
        return err(NOT_YOUR_TURN);
      }
      if (this.chess.isOver()) {
        return err(GAME_OVER);
      }
      if (this.chess.pieceAt(input.from) === null) {
        return err(SQUARE_EMPTY);
      }

      try {
        // stop the current colour's timer
        this.timer.stop(color);
        log.info("[Game.move:executing]", { id: this.id, color, from: input.from, to: input.to });

        // apply the move and advance the sequence
        const applied = this.chess.move(input.from, input.to, input.promoteTo);
        this.moveSeq++;

        // end the game if the move is decisive
        this.settleIfOver();

        // start the opponent's timer if the game is still active
        if (this.status === ACTIVE) this.timer.startNext(color === WHITE ? BLACK : WHITE);

        log.info("[Game.move:success]", { id: this.id, color, san: applied.san, status: this.status });
        return ok(applied);
      } catch (e) {
        if (e instanceof IllegalMoveError) {
          return err(ILLEGAL_MOVE);
        }
        log.error("[Game.move:exception]", { id: this.id, color, error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    });
  }

  /** End the game by resignation. Mutex-guarded. */
  async resign(by: PieceColor): Promise<Result<GameOutcome, GameError>> {
    return this.lock.run(async () => {
      // reject if the game is already over
      if (this.status !== ACTIVE) {
        return err(GAME_OVER);
      }

      // stop the clock and mark the game as finished
      this.timer.dispose();
      const winner = by === WHITE ? BLACK : WHITE;
      this.status = FINISHED;
      this.endReason = RESIGNATION;
      this.finishedAt = Date.now();
      log.info("[Game.resign:resigned]", { id: this.id, by, winner });

      return ok({
        status: this.chess.gameResult().status,
        winner,
        hasWinner: true,
        drawReason: NO_DRAW_REASON,
        reason: RESIGNATION,
      });
    });
  }

  /** End the game by abandonment (grace period expired). Mutex-guarded. */
  async abandon(by: PieceColor): Promise<void> {
    return this.lock.run(async () => {
      // skip if already finished
      if (this.status !== ACTIVE) {
        log.warn("[Game.abandon:skip]", { id: this.id, by, status: this.status });
        return;
      }

      // stop the clock and mark the game as finished
      this.timer.dispose();
      this.abandonedBy = by;
      this.status = FINISHED;
      this.endReason = ABANDONED;
      this.finishedAt = Date.now();
      log.info("[Game.abandon:abandoned]", { id: this.id, by, winner: by === WHITE ? BLACK : WHITE });

      // notify players of the outcome
      const outcome = this.outcome();
      this.broadcast(Notifications.gameEnded(this.id, outcome, outcome.winner));
    });
  }

  /** End the game by clock expiry. Mutex-guarded. */
  async expire(): Promise<void> {
    return this.lock.run(async () => {
      // skip if already finished
      if (this.status !== ACTIVE) {
        log.warn("[Game.expire:skip]", { id: this.id, status: this.status });
        return;
      }

      // stop the clock and mark the game as finished
      this.timer.dispose();
      this.status = FINISHED;
      this.endReason = TIMEOUT;
      this.finishedAt = Date.now();
      const expiredColor = this.chess.sideToMove();
      log.info("[Game.expire:expired]", { id: this.id, expiredColor, winner: expiredColor === WHITE ? BLACK : WHITE });

      // notify players of timeout and game end
      this.broadcast(Notifications.clockExpired(this.id, expiredColor));
      this.broadcast(Notifications.gameEnded(this.id, this.outcome(), this.outcome().winner));
    });
  }

  /** Undo the last move. Mutex-guarded. */
  async undo(): Promise<Result<Move, GameError>> {
    return this.lock.run(async () => {
      // reject if there is no history or the end type doesn't support undo
      if (this.status === WAITING) {
        return err(NO_HISTORY);
      }
      if (this.status === FINISHED && this.endReason !== RULES) {
        return err(NOT_ALLOWED);
      }

      try {
        const sideBefore = this.chess.sideToMove();
        const undone = this.chess.undoMove();

        // reopen the game if it was finished by a rules-based outcome
        const wasFinished = this.status === FINISHED;
        if (wasFinished) {
          this.status = ACTIVE;
          this.finishedAt = null;
        }

        // restart the timer for the colour whose turn it now is
        this.timer.stop(sideBefore);
        if (this.status === ACTIVE) this.timer.startNext(this.chess.sideToMove());

        log.info("[Game.undo:success]", { id: this.id, reopened: wasFinished, san: undone.san });
        return ok(undone);
      } catch (e) {
        if (e instanceof NothingToUndoError) {
          return err(NO_HISTORY);
        }
        log.error("[Game.undo:exception]", { id: this.id, error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    });
  }

  /** Build a full snapshot of the current game state for the client. */
  snapshot(): GameSnapshot {
    log.info("[Game.snapshot:start]", { id: this.id, status: this.status });

    const history = this.chess.moveHistory();
    const { capturedByWhite, capturedByBlack } = this.splitCaptures(history);
    const outcome = this.outcome();

    return {
      status: this.status,
      moveSeq: this.moveSeq,
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

  /** If the chess engine reports a decisive result, mark the game as finished. */
  private settleIfOver(): GameOutcome | null {
    const engineResult = this.chess.gameResult();
    if (engineResult.status === IN_PROGRESS) return null;
    this.status = FINISHED;
    this.endReason = RULES;
    this.finishedAt = Date.now();
    return this.outcome(engineResult);
  }

  /** Compute the game outcome based on the end reason and engine state. */
  private outcome(engineResult = this.chess.gameResult()): GameOutcome {
    // timeout: the side whose turn it is loses
    if (this.endReason === TIMEOUT) {
      const expiredSide = this.chess.sideToMove();
      return {
        status: IN_PROGRESS,
        winner: expiredSide === WHITE ? BLACK : WHITE,
        hasWinner: true,
        drawReason: NO_DRAW_REASON,
        reason: TIMEOUT,
      };
    }
    // abandonment: the abandoning side loses; if no opponent remains, white gets a default win
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
    // engine-determined outcome (checkmate, stalemate, etc.)
    return {
      status: engineResult.status,
      winner: engineResult.winner,
      hasWinner: engineResult.hasWinner,
      drawReason: engineResult.drawReason,
      reason: this.endReason ?? RULES,
    };
  }

  /** Split captured pieces by colour of the capturing piece. */
  private splitCaptures(history: readonly Move[]): { capturedByWhite: PieceType[]; capturedByBlack: PieceType[] } {
    const capturedByWhite: PieceType[] = [];
    const capturedByBlack: PieceType[] = [];
    for (const m of history) {
      if (!m.captured) continue;
      (m.piece.color === WHITE ? capturedByWhite : capturedByBlack).push(m.captured.type);
    }
    return { capturedByWhite, capturedByBlack };
  }
}
