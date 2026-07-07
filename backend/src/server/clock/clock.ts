import type { ClockType, ClockFormat } from "./types";

/** A time-control strategy: determines initial time, per-move adjustment, and turn-start delay. */
export interface Clock {
  /** Whether this resets per move ("move") or ticks down across the whole game ("match"). */
  readonly type: ClockType;

  /** Starting time per side in milliseconds. */
  readonly initialMs: number;

  /** Preset identifier used by the factory to pick this strategy. */
  readonly format: ClockFormat;

  /**
   * Called when a player's move completes, after their clock is stopped.
   * @param remainingMs — the player's time before this move
   * @param elapsedMs — how long the player took on this move
   * @returns the player's new remaining time after applying the rule
   */
  onMove(remainingMs: number, elapsedMs: number): number;

  /**
   * Called when the next player's turn begins, before their clock starts ticking.
   * @returns delay in ms before ticking should begin (0 for no delay)
   */
  onTurn(): number;
}
