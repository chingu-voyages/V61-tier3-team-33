import type { WebSocket } from "../../types";
import type { Session } from "./session";

/** Read-only access to stored sessions. */
export interface SessionReader {
  /** Look up a session by its WebSocket id. Returns null if not found. */
  bySocket(ws: WebSocket): Session | null;

  /** Look up a session by its resume token. Returns null if not found. */
  byToken(token: string): Session | null;

  /** Look up a session by its player id. Returns null if not found. */
  byPlayerId(playerId: string): Session | null;
}

/** Creates, updates, and cleans up stored sessions. */
export interface SessionWriter {
  /** Open a fresh session for the given player and WebSocket. */
  open(ws: WebSocket, playerId: string): Session;

  /** Resume an existing session by token, replacing its WebSocket. Returns null if the token is unknown. */
  resume(token: string, ws: WebSocket): Session | null;

  /** Try resume then fall back to open. */
  resumeOrOpen(ws: WebSocket, token?: string): Session;

  /** Mark a session as disconnected (sets disconnectedAt, removes from socket map). */
  drop(ws: WebSocket): void;

  /** Merge partial fields into the session bound to the given socket. */
  bind(ws: WebSocket, patch: Partial<Session>): void;

  /** Clear room binding for the session bound to the given socket. */
  clearSession(ws: WebSocket): void;

  /** Clear room binding only if the session's roomId matches expectedRoomId. */
  clearByPlayerId(playerId: string, expectedRoomId: string): void;

  /** Reconnect an existing socket to the session identified by playerId. */
  reattachSocket(ws: WebSocket, playerId: string): Session | null;

  /** Remove sessions whose disconnectedAt is older than the TTL. */
  prune(): void;

  /** Start periodic pruning at the given interval (ms). */
  startPruning(intervalMs: number): void;

  /** Stop periodic pruning. */
  stopPruning(): void;
}

export type SessionStore = SessionReader & SessionWriter;
