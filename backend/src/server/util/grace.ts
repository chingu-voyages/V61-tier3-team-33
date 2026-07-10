import type { PieceColor } from "../types";
import { logger as rootLogger } from "../../logging/log";

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
    this.cancel(key);

    const deadlineMs = Date.now() + timeoutMs;
    const handle = setTimeout(() => {
      log.info("[GRACE-expired]", { key, color, deadlineMs, wasActive: this.timers.has(key) });
      this.timers.delete(key);
      onExpire();
    }, timeoutMs);

    this.timers.set(key, { color, handle, deadlineMs, key });
    log.info("[GRACE-started]", { key, color, timeoutMs, deadlineMs, totalActive: this.timers.size });
    return deadlineMs;
  }

  /**
   * Cancels a grace timer for the given key, if one exists.
   * @returns true if a timer was actually cancelled.
   */
  cancel(key: string): boolean {
    const existing = this.timers.get(key);
    if (!existing) {
      log.info("[GRACE-cancel-noop]", { key, totalActive: this.timers.size });
      return false;
    }

    clearTimeout(existing.handle);
    this.timers.delete(key);
    log.info("[GRACE-cancelled]", { key, color: existing.color, remainingMs: existing.deadlineMs - Date.now(), totalActive: this.timers.size });
    return true;
  }

  /** Returns the grace deadline for a key, or null if none is running. */
  getDeadline(key: string): number | null {
    return this.timers.get(key)?.deadlineMs ?? null;
  }

  /** Cancels every running grace timer. Used for cleanup. */
  clear(): void {
    const count = this.timers.size;
    for (const { handle } of this.timers.values()) {
      clearTimeout(handle);
    }
    this.timers.clear();
    log.info("[GRACE-cleared]", { cancelled: count });
  }
}
