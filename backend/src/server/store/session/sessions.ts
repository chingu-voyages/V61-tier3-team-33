import { logger as rootLogger } from "../../../logging/logger";
import type { WebSocket } from "../../types";
import type { Session } from "./session";
import type { SessionStore } from "./session-store";

const log = rootLogger.child({ module: "Sessions" });

const DISCONNECTED_TTL_MS = 2 * 60 * 1000;
const DEFAULT_PRUNE_INTERVAL_MS = 30 * 1000;

function generatePlayerId(): string {
  return "p_" + crypto.randomUUID().slice(0, 8);
}

/** In-memory SessionStore: three maps keyed by socket id, token, and player id. */
export class Sessions implements SessionStore {
  private bySocketMap: Map<string, Session> = new Map();
  private byTokenMap: Map<string, Session> = new Map();
  private byPlayerIdMap: Map<string, Session> = new Map();
  private pruner: ReturnType<typeof setTimeout> | null = null;

  constructor(private disconnectedTtlMs = DISCONNECTED_TTL_MS) {
    this.startPruning();
  }

  /** Look up a session by its WebSocket id. Returns null if not found. */
  bySocket(ws: WebSocket): Session | null {
    return this.bySocketMap.get(ws.id) ?? null;
  }

  /** Look up a session by its resume token. Returns null if not found. */
  byToken(token: string): Session | null {
    return this.byTokenMap.get(token) ?? null;
  }

  /** Look up a session by its player id. Returns null if not found. */
  byPlayerId(playerId: string): Session | null {
    return this.byPlayerIdMap.get(playerId) ?? null;
  }

  /** Open a fresh session: generate token + player id, register in all three maps. */
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

    // register in all three indexes
    this.bySocketMap.set(ws.id, session);
    this.byTokenMap.set(session.token, session);
    this.byPlayerIdMap.set(session.playerId, session);

    log.info("[Sessions.open:opened]", {
      playerId,
      token: session.token,
      wsId: ws.id,
      bySocketCount: this.bySocketMap.size,
      byTokenCount: this.byTokenMap.size,
    });

    return session;
  }

  /** Resume an existing session by token: replace its WebSocket and clear disconnectedAt. */
  resume(token: string, ws: WebSocket): Session | null {
    const session = this.byTokenMap.get(token);
    if (!session) {
      log.warn("[Sessions.resume:miss]", { token: token.slice(0, 8), wsId: ws.id });
      return null;
    }

    // swap socket references
    const oldWs = session.ws;
    const oldWsId = oldWs.id;
    this.bySocketMap.delete(oldWsId);
    session.ws = ws;
    session.disconnectedAt = null;
    this.bySocketMap.set(ws.id, session);

    // close the old socket so it stops receiving events
    if (oldWs !== ws) oldWs.close(4000, "superseded");

    log.info("[Sessions.resume:resumed]", {
      playerId: session.playerId,
      oldWsId,
      newWsId: ws.id,
      roomId: session.roomId,
      color: session.color,
      mode: session.mode,
    });

    return session;
  }

  /** Try resume by token; fall back to opening a fresh session. */
  resumeOrOpen(ws: WebSocket, token?: string): Session {
    // attempt to resume an existing session
    const resumed = token ? this.resume(token, ws) : undefined;
    if (resumed) {
      log.info("[Sessions.resumeOrOpen:resumed]", {
        playerId: resumed.playerId,
        roomId: resumed.roomId,
        color: resumed.color,
      });
      return resumed;
    }

    // fall back to a fresh session
    const opened = this.open(ws, generatePlayerId());
    log.info("[Sessions.resumeOrOpen:fresh]", { playerId: opened.playerId, hadToken: Boolean(token) });
    return opened;
  }

  /** Mark a session as disconnected: remove from socket map, set disconnectedAt. */
  drop(ws: WebSocket): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) {
      log.warn("[Sessions.drop:miss]", { wsId: ws.id });
      return;
    }

    const priorDisconnected = session.disconnectedAt;
    this.bySocketMap.delete(ws.id);
    session.disconnectedAt = Date.now();

    log.info("[Sessions.drop:dropped]", {
      playerId: session.playerId,
      wsId: ws.id,
      wasDisconnected: priorDisconnected !== null,
      roomId: session.roomId,
      color: session.color,
      disconnectedAt: session.disconnectedAt,
    });
  }

  /** Merge partial fields into the session bound to the given socket. */
  bind(ws: WebSocket, patch: Partial<Session>): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) {
      log.warn("[Sessions.bind:miss]", { wsId: ws.id, patch });
      return;
    }

    const before = { roomId: session.roomId, color: session.color, mode: session.mode };
    Object.assign(session, patch);

    log.info("[Sessions.bind:bound]", {
      playerId: session.playerId,
      wsId: ws.id,
      before,
      after: { roomId: session.roomId, color: session.color, mode: session.mode },
    });
  }

  /** Clear room binding for the session bound to the given socket. */
  clearSession(ws: WebSocket): void {
    const session = this.bySocketMap.get(ws.id);
    if (!session) {
      log.warn("[Sessions.clearSession:miss]", { wsId: ws.id });
      return;
    }

    log.info("[Sessions.clearSession:cleared]", {
      playerId: session.playerId,
      wsId: ws.id,
      before: { roomId: session.roomId, color: session.color, mode: session.mode },
    });
    this.clearFields(session);
  }

  /** Reconnect an existing socket to the session identified by playerId. */
  reattachSocket(ws: WebSocket, playerId: string): Session | null {
    const session = this.byPlayerIdMap.get(playerId);
    if (!session) {
      log.warn("[Sessions.reattachSocket:miss]", { playerId, wsId: ws.id });
      return null;
    }

    // swap socket references
    this.bySocketMap.delete(session.ws.id);
    session.ws = ws;
    session.disconnectedAt = null;
    this.bySocketMap.set(ws.id, session);

    log.info("[Sessions.reattachSocket:reattached]", { playerId, wsId: ws.id });
    return session;
  }

  /** Clear room binding only if the session's roomId matches expectedRoomId. */
  clearByPlayerId(playerId: string, expectedRoomId: string): void {
    const session = this.byPlayerIdMap.get(playerId);
    if (!session) {
      log.warn("[Sessions.clearByPlayerId:miss]", { playerId, expectedRoomId });
      return;
    }

    // skip if the player has already moved to a different room
    if (session.roomId !== expectedRoomId) {
      log.info("[Sessions.clearByPlayerId:skip-moved]", { playerId, expectedRoomId, actualRoomId: session.roomId });
      return;
    }

    log.info("[Sessions.clearByPlayerId:cleared]", { playerId, roomId: expectedRoomId });
    this.clearFields(session);
  }

  /** Reset room-related fields to null. */
  private clearFields(session: Session): void {
    session.roomId = null;
    session.color = null;
    session.mode = null;
  }

  /** Remove sessions whose disconnectedAt is older than the TTL. */
  prune(): void {
    let count = 0;
    for (const session of this.byTokenMap.values()) {
      if (this.isExpired(session)) {
        log.info("[Sessions.prune:expired]", {
          playerId: session.playerId,
          roomId: session.roomId,
          color: session.color,
          disconnectedAt: session.disconnectedAt,
          staleForMs: Date.now() - session.disconnectedAt!,
        });
        this.byTokenMap.delete(session.token);
        this.byPlayerIdMap.delete(session.playerId);
        count++;
      }
    }

    if (count > 0) {
      log.info("[Sessions.prune:summary]", {
        pruned: count,
        remaining: this.byTokenMap.size,
        remainingBySocket: this.bySocketMap.size,
      });
    }
  }

  /** Start periodic pruning at the given interval (ms). */
  startPruning(intervalMs: number = DEFAULT_PRUNE_INTERVAL_MS): void {
    if (this.pruner) this.stopPruning();

    const tick = () => {
      this.prune();
      this.pruner = setTimeout(tick, intervalMs);
    };

    this.pruner = setTimeout(tick, intervalMs);
  }

  /** Stop periodic pruning. */
  stopPruning(): void {
    if (!this.pruner) return;
    clearTimeout(this.pruner);
    this.pruner = null;
  }

  /** True if the session has been disconnected longer than the TTL. */
  private isExpired(session: Session): boolean {
    if (session.disconnectedAt === null) return false;
    return Date.now() - session.disconnectedAt > this.disconnectedTtlMs;
  }
}
