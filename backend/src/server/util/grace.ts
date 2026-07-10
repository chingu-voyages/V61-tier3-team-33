import type { PieceColor } from "../types";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Grace" });

interface GraceEntry {
  color: PieceColor;
  handle: ReturnType<typeof setTimeout>;
  deadlineMs: number;
  roomId: string;
}

/**
 * Manages per-room grace periods for disconnected players.
 * When a player disconnects during an active game, a grace timer starts.
 * If they reconnect before it expires, cancel it. If it expires, abandon the game.
 */
export class Grace {
  private timers = new Map<string, GraceEntry>();

  /**
   * Starts (or restarts) a grace timer for the given room.
   * @returns the deadline in epoch ms.
   */
  start(roomId: string, color: PieceColor, timeoutMs: number, onExpire: () => void): number {
    this.cancel(roomId);

    const deadlineMs = Date.now() + timeoutMs;
    const handle = setTimeout(() => {
      log.info("[GRACE-expired]", { roomId, color, deadlineMs, wasActive: this.timers.has(roomId) });
      this.timers.delete(roomId);
      onExpire();
    }, timeoutMs);

    this.timers.set(roomId, { color, handle, deadlineMs, roomId });
    log.info("[GRACE-started]", { roomId, color, timeoutMs, deadlineMs, totalActive: this.timers.size });
    return deadlineMs;
  }

  /**
   * Cancels a grace timer for the given room, if one exists.
   * @returns true if a timer was actually cancelled.
   */
  cancel(roomId: string): boolean {
    const existing = this.timers.get(roomId);
    if (!existing) {
      log.info("[GRACE-cancel-noop]", { roomId, totalActive: this.timers.size });
      return false;
    }

    clearTimeout(existing.handle);
    this.timers.delete(roomId);
    log.info("[GRACE-cancelled]", { roomId, color: existing.color, remainingMs: existing.deadlineMs - Date.now(), totalActive: this.timers.size });
    return true;
  }

  /** Returns the grace deadline for a room, or null if none is running. */
  getDeadline(roomId: string): number | null {
    return this.timers.get(roomId)?.deadlineMs ?? null;
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
