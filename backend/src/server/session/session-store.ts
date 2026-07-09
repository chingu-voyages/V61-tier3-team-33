import type { WebSocket } from "../types";
import type { Session } from "./session";

/** Read-only — services that need to find sessions but never mutate them. */
export interface SessionReader {
  /**
   * Looks up the session currently bound to this socket.
   * @param ws — socket to look up
   */
  bySocket(ws: WebSocket): Session | null;
  /**
   * Looks up a session by its resume token, regardless of connection state.
   * @param token — resume token to look up
   */
  byToken(token: string): Session | null;
  /**
   * Looks up a session by its player id, regardless of connection state.
   * @param playerId — the player's id
   */
  byPlayerId(playerId: string): Session | null;
}

/** Write — services that mutate sessions. */
export interface SessionWriter {
  /**
   * Creates and stores a new session for a freshly connected socket.
   * @param ws — socket to bind the new session to
   */
  open(ws: WebSocket, playerId: string): Session;
  /**
   * Reattaches a prior session to a new socket, or null if the token is invalid/expired.
   * @param token — resume token to look up
   */
  resume(token: string, ws: WebSocket): Session | null;
  /**
   * Resumes the session for `token` if it's valid, reattaching it to `ws`;
   * otherwise opens a brand new session for `ws` with a freshly generated playerId.
   */
  resumeOrOpen(ws: WebSocket, token?: string): Session;
  /**
   * Removes the session bound to this socket, e.g. on disconnect.
   * @param ws — socket whose session to disconnect
   */
  drop(ws: WebSocket): void;
  /**
   * Merges the given fields into the session bound to this socket.
   */
  bind(ws: WebSocket, patch: Partial<Session>): void;
  /** Removes all expired sessions immediately. */
  prune(): void;
  /**
   * Begins periodic pruning of expired sessions every intervalMs.
   * @param intervalMs — ms between prune cycles
   */
  startPruning(intervalMs: number): void;
  /** Stops periodic pruning started by startPruning. */
  stopPruning(): void;
}

/** Combined (SessionReader & SessionWriter) */
export type SessionStore = SessionReader & SessionWriter;
