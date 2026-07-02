import type { WebSocket } from "../domain/types";
import type { Session } from "./session";

/** Read-only — services that need to find sessions but never mutate them. */
export interface SessionReader {
  /** Looks up the session currently bound to this socket. */
  bySocket(ws: WebSocket): Session | null;
  /** Looks up a session by its resume token, regardless of connection state. */
  byToken(token: string): Session | null;
}

/** Write — services that mutate sessions. */
export interface SessionWriter {
  /** Creates and stores a new session for a freshly connected socket. */
  open(ws: WebSocket, playerId: string): Session;
  /** Reattaches a prior session to a new socket, or null if the token is invalid/expired. */
  resume(token: string, ws: WebSocket): Session | null;
  /** Removes the session bound to this socket, e.g. on disconnect. */
  drop(ws: WebSocket): void;
  /** Merges the given fields into the session bound to this socket. */
  bind(ws: WebSocket, patch: Partial<Session>): void;
  /** Removes all expired sessions immediately. */
  prune(): void;
  /** Begins periodic pruning of expired sessions every intervalMs. */
  startPruning(intervalMs: number): void;
  /** Stops periodic pruning started by startPruning. */
  stopPruning(): void;
}

/** Combined (SessionReader & SessionWriter) */
export type SessionStore = SessionReader & SessionWriter;
