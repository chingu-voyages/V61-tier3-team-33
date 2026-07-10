import { WHITE, BLACK, type PieceColor, type ClockState } from "../types";
import { type Publisher } from "../bus/bus";
import { Notifications } from "../protocol/events";
import type { Clock } from "./clock";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "ClockTimer" });

/** A running chess clock for one game. */
export interface Timer {
  /** The time-control strategy this timer was created with. */
  readonly strategy: Clock;

  /** Snapshot of remaining time per side and whose clock is active. */
  readonly state: ClockState;

  /**
   * Begins counting down for the given color.
   * Sets initial time for both sides, emits CLOCK_STARTED,
   * and schedules a single timer for exact expiration.
   * Called once when the game transitions from WAITING to ACTIVE.
   */
  start(whiteMs: number, blackMs: number, color: PieceColor): void;

  /**
   * Stops the active player's clock.
   * Calculates elapsed time, applies `strategy.onMove()` for time adjustment,
   * emits CLOCK_PAUSED, and clears expiration timer.
   * @returns the adjusted remaining time for the player who just moved
   */
  stop(color: PieceColor): number;

  /**
   * Starts the opponent's clock after a move.
   * Consults `strategy.onTurn()` for any delay (simple / Bronstein).
   * Emits CLOCK_STARTED once ticking actually begins.
   */
  startNext(color: PieceColor): void;

  /** Stops all timers and marks the clock inactive. Called when the game ends. */
  dispose(): void;
}

export class ClockTimer implements Timer {
  private whiteMs!: number;
  private blackMs!: number;
  private active: PieceColor | null = null;
  private turnStartedAt: number = 0;
  private expireTimer: ReturnType<typeof setTimeout> | null = null;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly strategy: Clock,
    private roomId: string,
    private publisher: Publisher,
  ) {
    log.info("[TIMER-created]", { roomId, format: strategy.format, initialMs: strategy.initialMs, type: strategy.type });
  }

  /** {@inheritDoc} */
  get state(): ClockState {
    const elapsed = this.active !== null ? Date.now() - this.turnStartedAt : 0;
    return {
      whiteMs: Math.max(0, this.whiteMs - (this.active === WHITE ? elapsed : 0)),
      blackMs: Math.max(0, this.blackMs - (this.active === BLACK ? elapsed : 0)),
      active: this.active,
    };
  }

  /** {@inheritDoc} */
  start(whiteMs: number, blackMs: number, color: PieceColor): void {
    this.whiteMs = whiteMs;
    this.blackMs = blackMs;
    this.turnStartedAt = Date.now();
    this.active = color;
    log.info("[TIMER-start]", { roomId: this.roomId, color, whiteMs, blackMs });
    this.publisher.emit(Notifications.clockStarted(this.roomId, color, this.timeFor(color)));
    this.scheduleExpiration();
  }

  /** {@inheritDoc} */
  stop(color: PieceColor): number {
    this.clearTimers();
    const elapsed = this.active !== null ? Date.now() - this.turnStartedAt : 0;
    const wasActive = this.active;
    this.active = null;
    const remaining = this.timeFor(color);
    const newRemaining = Math.max(0, this.strategy.onMove(remaining, elapsed));
    this.setTime(color, newRemaining);
    log.info("[TIMER-stop]", { roomId: this.roomId, color, wasActive, elapsed, remaining, newRemaining });
    this.publisher.emit(Notifications.clockPaused(this.roomId, color, newRemaining));
    return newRemaining;
  }

  /** {@inheritDoc} */
  startNext(color: PieceColor): void {
    const delay = this.strategy.onTurn();
    log.info("[TIMER-startNext]", { roomId: this.roomId, color, delay });
    if (delay > 0) {
      this.delayTimer = setTimeout(() => {
        log.info("[TIMER-delay-done]", { roomId: this.roomId, color, delay });
        this.resumeTicking(color);
      }, delay);
    } else {
      this.resumeTicking(color);
    }
  }

  /** {@inheritDoc} */
  dispose(): void {
    log.info("[TIMER-dispose]", { roomId: this.roomId, wasActive: this.active, whiteMs: this.whiteMs, blackMs: this.blackMs });
    this.clearTimers();
    this.active = null;
  }

  private resumeTicking(color: PieceColor): void {
    this.turnStartedAt = Date.now();
    this.active = color;
    this.publisher.emit(Notifications.clockStarted(this.roomId, color, this.timeFor(color)));
    this.scheduleExpiration();
  }

  private scheduleExpiration(): void {
    if (this.active === null) return;
    const remaining = this.timeFor(this.active);
    this.expireTimer = setTimeout(() => {
      if (this.active === null) return;
      this.setTime(this.active, 0);
      this.expireTimer = null;
      const color = this.active;
      this.active = null;
      this.publisher.emit(Notifications.clockExpired(this.roomId, color));
    }, remaining);
  }

  private clearTimers(): void {
    if (this.expireTimer !== null) {
      clearTimeout(this.expireTimer);
      this.expireTimer = null;
    }
    if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
  }

  private timeFor(color: PieceColor): number {
    return color === WHITE ? this.whiteMs : this.blackMs;
  }

  private setTime(color: PieceColor, ms: number): void {
    if (color === WHITE) {
      this.whiteMs = ms;
    } else {
      this.blackMs = ms;
    }
  }
}
