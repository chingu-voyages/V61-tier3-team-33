import { logger as rootLogger } from "../../logging/logger";
import type { PieceColor } from "../types";

const log = rootLogger.child({ module: "Grace" });

interface GraceEntry {
  color: PieceColor;
  handle: ReturnType<typeof setTimeout>;
  deadlineMs: number;
  key: string;
}

/**
 * Manages grace periods for disconnected players, one timer per `key`.
 * `key` is caller-defined — production code keys by playerId (one grace
 * period per player, independent of which room they're in), but Grace
 * itself doesn't know or care what the string represents.
 * When a player disconnects during an active game, a grace timer starts.
 * If they reconnect before it expires, cancel it. If it expires, abandon the game.
 */
export class Grace {
  private timers = new Map<string, GraceEntry>();

  /**
   * Starts (or restarts) a grace timer for the given key.
   * @returns the deadline in epoch ms.
   */
  start(key: string, color: PieceColor, timeoutMs: number, onExpire: () => void): number {
    // cancel any existing grace timer for this key
    this.cancel(key);

    // schedule expiration callback
    const deadlineMs = Date.now() + timeoutMs;
    const handle = setTimeout(() => {
      log.info("[Grace.start:expired]", { key, color, deadlineMs, wasActive: this.timers.has(key) });
      this.timers.delete(key);
      onExpire();
    }, timeoutMs);

    // store timer and log start
    this.timers.set(key, { color, handle, deadlineMs, key });
    log.info("[Grace.start:started]", { key, color, timeoutMs, deadlineMs, totalActive: this.timers.size });
    return deadlineMs;
  }

  /**
   * Cancels a grace timer for the given key, if one exists.
   * @returns true if a timer was actually cancelled.
   */
  cancel(key: string): boolean {
    // look up existing grace timer by key
    const existing = this.timers.get(key);
    if (!existing) {
      log.info("[Grace.cancel:no-op]", { key, totalActive: this.timers.size });
      return false;
    }

    // clear the timer and remove entry
    clearTimeout(existing.handle);
    this.timers.delete(key);

    // log cancelled timer
    log.info("[Grace.cancel:cancelled]", {
      key,
      color: existing.color,
      remainingMs: existing.deadlineMs - Date.now(),
      totalActive: this.timers.size,
    });
    return true;
  }

  /** Returns the grace deadline for a key, or null if none is running. */
  getDeadline(key: string): number | null {
    return this.timers.get(key)?.deadlineMs ?? null;
  }

  /** Cancels every running grace timer. Used for cleanup. */
  clear(): void {
    // cancel all active grace timers
    const count = this.timers.size;
    for (const { handle } of this.timers.values()) {
      clearTimeout(handle);
    }
    this.timers.clear();

    // log cleanup summary
    log.info("[Grace.clear:cleared]", { cancelled: count });
  }
}
