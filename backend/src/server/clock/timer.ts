import { WHITE, type PieceColor, type ClockState } from "../domain/types";
import { type Publisher } from "../bus/bus";
import { Signals, Notifications } from "../protocol/events";
import type { Clock } from "./clock";

/** A running chess clock for one game. */
export interface Timer {
  /** The time-control strategy this timer was created with. */
  readonly strategy: Clock;

  /** Snapshot of remaining time per side and whose clock is active. */
  readonly state: ClockState;

  /**
   * Begins counting down for the given color.
   * Sets initial time for both sides, emits CLOCK_STARTED, and starts the tick loop.
   * Called once when the game transitions from WAITING to ACTIVE.
   */
  start(whiteMs: number, blackMs: number, color: PieceColor): void;

  /**
   * Stops the active player's clock.
   * Calculates elapsed time, applies `strategy.onMove()` for time adjustment,
   * emits CLOCK_PAUSED, and clears timers.
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
  private lastTickAt: number = 0;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly strategy: Clock,
    private roomId: string,
    private publisher: Publisher,
    private tickIntervalMs: number = 1000,
  ) {}

  /** {@inheritDoc} */
  get state(): ClockState {
    return {
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      active: this.active,
    };
  }

  /** {@inheritDoc} */
  start(whiteMs: number, blackMs: number, color: PieceColor): void {
    this.whiteMs = whiteMs;
    this.blackMs = blackMs;
    this.turnStartedAt = Date.now();
    this.lastTickAt = Date.now();
    this.active = color;
    this.publisher.emit(Notifications.clockStarted(this.roomId, color, this.timeFor(color)));
    this.scheduleTick();
  }

  /** {@inheritDoc} */
  stop(color: PieceColor): number {
    this.clearTimers();
    const elapsed = Date.now() - this.turnStartedAt;
    this.active = null;
    const remaining = this.timeFor(color);
    const newRemaining = Math.max(0, this.strategy.onMove(remaining, elapsed));
    this.setTime(color, newRemaining);
    this.publisher.emit(Notifications.clockPaused(this.roomId, color, newRemaining));
    return newRemaining;
  }

  /** {@inheritDoc} */
  startNext(color: PieceColor): void {
    const delay = this.strategy.onTurn();
    if (delay > 0) {
      this.delayTimer = setTimeout(() => this.resumeTicking(color), delay);
    } else {
      this.resumeTicking(color);
    }
  }

  /** {@inheritDoc} */
  dispose(): void {
    this.clearTimers();
    this.active = null;
  }

  private resumeTicking(color: PieceColor): void {
    this.turnStartedAt = Date.now();
    this.lastTickAt = Date.now();
    this.active = color;
    this.publisher.emit(Notifications.clockStarted(this.roomId, color, this.timeFor(color)));
    this.scheduleTick();
  }

  private scheduleTick(): void {
    this.tickTimer = setTimeout(() => this.tick(), this.tickIntervalMs);
  }

  private tick(): void {
    if (this.active === null) return;
    const now = Date.now();
    const elapsed = now - this.lastTickAt;
    this.lastTickAt = now;
    const color = this.active;
    const remaining = this.timeFor(color) - elapsed;

    if (remaining <= 0) {
      this.setTime(color, 0);
      this.tickTimer = null;
      this.active = null;
      this.publisher.emit(Signals.clockTick(this.roomId, this.state));
      this.publisher.emit(Notifications.clockExpired(this.roomId, color));
      return;
    }

    this.setTime(color, remaining);
    this.publisher.emit(Signals.clockTick(this.roomId, this.state));
    this.scheduleTick();
  }

  private clearTimers(): void {
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
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
