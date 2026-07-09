import type { WebSocket } from "../types";
import type { Session } from "./session";
import type { SessionStore } from "./session-store";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Sessions" });

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

    log.info("[SESSION-open]", { playerId, token: session.token, wsId: ws.id, bySocketCount: this.bySocketMap.size, byTokenCount: this.byTokenMap.size });

    return session;
  }

  /** {@inheritDoc} */
  resume(token: string, ws: WebSocket): Session | null {
    const session = this.byTokenMap.get(token);
    if (!session) {
      log.warn("[SESSION-resume-miss]", { token: token.slice(0, 8), wsId: ws.id });
      return null;
    }

    const oldWsId = session.ws.id;
    this.bySocketMap.delete(oldWsId);
    session.ws = ws;
    session.disconnectedAt = null;
    this.bySocketMap.set(ws.id, session);

    log.info("[SESSION-resume]", { playerId: session.playerId, oldWsId, newWsId: ws.id, roomId: session.roomId, color: session.color, mode: session.mode });

    return session;
  }

  /** {@inheritDoc} */
  resumeOrOpen(ws: WebSocket, token?: string): Session {
    const resumed = token ? this.resume(token, ws) : undefined;
    if (resumed) {
      log.info("[SESSION-resumeOrOpen-resumed]", { playerId: resumed.playerId, roomId: resumed.roomId, color: resumed.color });
      return resumed;
    }
    const opened = this.open(ws, generatePlayerId());
    log.info("[SESSION-resumeOrOpen-fresh]", { playerId: opened.playerId, hadToken: Boolean(token) });
    return opened;
  }

  /** {@inheritDoc} */
  drop(ws: WebSocket): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) {
      log.warn("[SESSION-drop-miss]", { wsId: ws.id });
      return;
    }

    const priorDisconnected = session.disconnectedAt;
    this.bySocketMap.delete(ws.id);
    session.disconnectedAt = Date.now();

    log.info("[SESSION-drop]", { playerId: session.playerId, wsId: ws.id, wasDisconnected: priorDisconnected !== null, roomId: session.roomId, color: session.color, disconnectedAt: session.disconnectedAt });
  }

  /** {@inheritDoc} */
  bind(ws: WebSocket, patch: Partial<Session>): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) {
      log.warn("[SESSION-bind-miss]", { wsId: ws.id, patch });
      return;
    }

    const before = { roomId: session.roomId, color: session.color, mode: session.mode };
    Object.assign(session, patch);
    log.info("[SESSION-bind]", { playerId: session.playerId, wsId: ws.id, before, after: { roomId: session.roomId, color: session.color, mode: session.mode } });
  }

  /** {@inheritDoc} */
  clearSession(ws: WebSocket): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) {
      log.warn("[SESSION-clearSession-miss]", { wsId: ws.id });
      return;
    }

    log.info("[SESSION-clearSession]", { playerId: session.playerId, wsId: ws.id, before: { roomId: session.roomId, color: session.color, mode: session.mode } });
    session.roomId = null;
    session.color = null;
    session.mode = null;
  }

  /** {@inheritDoc} */
  prune(): void {
    let count = 0;
    for (const session of this.byTokenMap.values()) {
      if (this.isExpired(session)) {
        log.info("[SESSION-prune]", { playerId: session.playerId, roomId: session.roomId, color: session.color, disconnectedAt: session.disconnectedAt, staleForMs: Date.now() - session.disconnectedAt! });
        this.byTokenMap.delete(session.token);
        this.byPlayerIdMap.delete(session.playerId);
        count++;
      }
    }
    if (count > 0) {
      log.info("[SESSION-prune-summary]", { pruned: count, remaining: this.byTokenMap.size, remainingBySocket: this.bySocketMap.size });
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
