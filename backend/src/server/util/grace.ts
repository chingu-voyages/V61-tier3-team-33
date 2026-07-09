import type { PieceColor } from "../types";

interface GraceEntry {
  color: PieceColor;
  handle: ReturnType<typeof setTimeout>;
  deadlineMs: number;
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
      this.timers.delete(roomId);
      onExpire();
    }, timeoutMs);

    this.timers.set(roomId, { color, handle, deadlineMs });
    return deadlineMs;
  }

  /**
   * Cancels a grace timer for the given room, if one exists.
   * @returns true if a timer was actually cancelled.
   */
  cancel(roomId: string): boolean {
    const existing = this.timers.get(roomId);
    if (!existing) return false;

    clearTimeout(existing.handle);
    this.timers.delete(roomId);
    return true;
  }

  /** Returns the grace deadline for a room, or null if none is running. */
  getDeadline(roomId: string): number | null {
    return this.timers.get(roomId)?.deadlineMs ?? null;
  }

  /** Cancels every running grace timer. Used for cleanup. */
  clear(): void {
    for (const { handle } of this.timers.values()) {
      clearTimeout(handle);
    }
    this.timers.clear();
  }
}
