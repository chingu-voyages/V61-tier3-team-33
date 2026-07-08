import type { WebSocket } from "../types";
import type { Session } from "./session";
import type { SessionStore } from "./session-store";

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
  private bySocketMap: Map<string, Session> = new Map();
  private byTokenMap: Map<string, Session> = new Map();
  private byPlayerIdMap: Map<string, Session> = new Map();
  private pruner: ReturnType<typeof setTimeout> | null = null;

  constructor(private disconnectedTtlMs = DISCONNECTED_TTL_MS) {}

  /** {@inheritDoc} */
  bySocket(ws: WebSocket): Session | null {
    return this.bySocketMap.get(ws.id) ?? null;
  }

  /** {@inheritDoc} */
  byToken(token: string): Session | null {
    return this.byTokenMap.get(token) ?? null;
  }

  /** {@inheritDoc} */
  byPlayerId(playerId: string): Session | null {
    return this.byPlayerIdMap.get(playerId) ?? null;
  }

  /** {@inheritDoc} */
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

    this.bySocketMap.set(ws.id, session);
    this.byTokenMap.set(session.token, session);
    this.byPlayerIdMap.set(session.playerId, session);

    return session;
  }

  /** {@inheritDoc} */
  resume(token: string, ws: WebSocket): Session | null {
    const session = this.byTokenMap.get(token);
    if (!session) return null;

    this.bySocketMap.delete(session.ws.id);
    session.ws = ws;
    session.disconnectedAt = null;
    this.bySocketMap.set(ws.id, session);

    return session;
  }

  /** {@inheritDoc} */
  resumeOrOpen(ws: WebSocket, token?: string): Session {
    const resumed = token ? this.resume(token, ws) : undefined;
    return resumed ?? this.open(ws, generatePlayerId());
  }

  /** {@inheritDoc} */
  drop(ws: WebSocket): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) return;

    this.bySocketMap.delete(ws.id);
    session.disconnectedAt = Date.now();
  }

  /** {@inheritDoc} */
  bind(ws: WebSocket, patch: Partial<Session>): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) return;

    Object.assign(session, patch);
  }

  /** {@inheritDoc} */
  prune(): void {
    for (const session of this.byTokenMap.values()) {
      if (this.isExpired(session)) {
        this.byTokenMap.delete(session.token);
        this.byPlayerIdMap.delete(session.playerId);
      }
    }
  }

  /** {@inheritDoc} */
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

  /** {@inheritDoc} */
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
