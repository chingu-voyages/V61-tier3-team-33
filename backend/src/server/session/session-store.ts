import type { WebSocket } from "../domain/types";
import type { Session } from "./session";
import type { SessionStore } from "./sessions";

// How long a disconnected session is kept around before being pruned —
// long enough for a client to reconnect (resume) after a network blip.
const DISCONNECTED_TTL_MS = 2 * 60 * 1000;

// How often the pruner checks for expired sessions.
const DEFAULT_PRUNE_INTERVAL_MS = 30 * 1000;

// Minimal Phase 1: assign a random player ID, no real auth.
function generatePlayerId(): string {
  return "p_" + crypto.randomUUID().slice(0, 8);
}

/**
 * In-memory implementation of SessionStore, backed by two Maps that both
 * point at the same Session objects: one keyed by the live WebSocket
 * (identity, not value — see `open`), one keyed by resume token.
 */
export class Sessions implements SessionStore {
  private bySocketMap: Map<WebSocket, Session> = new Map();
  private byTokenMap: Map<string, Session> = new Map();
  private pruner: ReturnType<typeof setTimeout> | null = null;

  constructor(private disconnectedTtlMs = DISCONNECTED_TTL_MS) {}

  /** Looks up the session currently bound to this socket. */
  bySocket(ws: WebSocket): Session | null {
    return this.bySocketMap.get(ws) ?? null;
  }

  /** Looks up a session by its resume token, regardless of connection state. */
  byToken(token: string): Session | null {
    return this.byTokenMap.get(token) ?? null;
  }

  /** Creates and stores a new session for a freshly connected socket. */
  open(ws: WebSocket, playerId: string): Session {
    const session: Session = {
      token: crypto.randomUUID(),
      playerId,
      ws,
      roomId: null,
      color: null,
      mode: null,
      connectedAt: Date.now(),
      disconnectedAt: null,
    };

    this.bySocketMap.set(ws, session);
    this.byTokenMap.set(session.token, session);

    return session;
  }

  /**
   * Reattaches a prior session to a new socket, or null if the token is
   * invalid/expired. Rekeys `bySocketMap`: the old socket's entry is
   * removed and a new one is added under the new socket, since a Map keyed
   * by object identity has no way to "rename" a key in place.
   */
  resume(token: string, ws: WebSocket): Session | null {
    const session = this.byTokenMap.get(token);
    if (!session) return null;

    this.bySocketMap.delete(session.ws);
    session.ws = ws;
    session.disconnectedAt = null;
    this.bySocketMap.set(ws, session);

    return session;
  }

  /**
   * Resumes the session for `token` if it's valid, reattaching it to `ws`;
   * otherwise opens a brand new session for `ws` with a freshly generated
   * playerId.
   */
  resumeOrOpen(ws: WebSocket, token?: string): Session {
    const resumed = token ? this.resume(token, ws) : undefined;
    return resumed ?? this.open(ws, generatePlayerId());
  }

  /**
   * Marks the session bound to this socket as disconnected, e.g. on
   * disconnect. Unlike `Games.drop`, this does NOT immediately erase the
   * session — it's removed from `bySocketMap` (the socket is dead, so
   * there's nothing left to look it up by) but stays in `byTokenMap`,
   * stamped with `disconnectedAt`, so `resume()` can still reattach it
   * within `disconnectedTtlMs`. `prune()` is what actually deletes it once
   * that window passes without a reconnect.
   */
  drop(ws: WebSocket): void {
    const session = this.bySocketMap.get(ws);
    if (!session) return;

    this.bySocketMap.delete(ws);
    session.disconnectedAt = Date.now();
  }

  /**
   * Merges the given fields into the session bound to this socket. Since
   * `bySocketMap` and `byTokenMap` hold the same Session object, mutating
   * it here is visible through both indexes with no re-sync needed.
   */
  bind(ws: WebSocket, patch: Partial<Session>): void {
    const session = this.bySocketMap.get(ws);
    if (!session) return;

    Object.assign(session, patch);
  }

  /** Removes all sessions that have been disconnected past `disconnectedTtlMs`. */
  prune(): void {
    for (const session of this.byTokenMap.values()) {
      if (this.isExpired(session)) {
        this.byTokenMap.delete(session.token);
      }
    }
  }

  /**
   * Begins periodic pruning every `intervalMs`. Restarts cleanly if already running.
   */
  startPruning(intervalMs: number = DEFAULT_PRUNE_INTERVAL_MS): void {
    if (this.pruner) {
      this.stopPruning();
    }

    const tick = () => {
      this.prune();
      this.pruner = setTimeout(tick, intervalMs);
    };

    this.pruner = setTimeout(tick, intervalMs);
  }

  /** Stops periodic pruning started by `startPruning`. Safe to call if not running. */
  stopPruning(): void {
    if (!this.pruner) return;

    clearTimeout(this.pruner);
    this.pruner = null;
  }

  /** True if `session` is disconnected and has been for longer than `disconnectedTtlMs`. */
  private isExpired(session: Session): boolean {
    if (session.disconnectedAt === null) return false;
    return Date.now() - session.disconnectedAt > this.disconnectedTtlMs;
  }
}
