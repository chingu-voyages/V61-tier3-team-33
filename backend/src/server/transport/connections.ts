import type { WebSocket } from "../domain/types";
import type { Publisher } from "../bus/bus";
import type { Protocol } from "../protocol/protocol";
import type { SessionStore } from "../session/sessions";
import type { Notification } from "../protocol/events";
import { CONNECTION_OPENED, CONNECTION_CLOSED } from "../protocol/events";
import { Reply } from "../protocol/replies";

/**
 * Owns the connection lifecycle: handshake (resume-or-open a session),
 * disconnect, heartbeat, and outbound delivery.
 * Gateway decodes the wire command and routes it here; Connections is what
 * actually touches sessions, the Hub, and the socket.
 */
export class Connections {
  constructor(
    private sessions: SessionStore,
    private publisher: Publisher,
    private protocol: Protocol,
  ) {}

  /**
   * Resumes the caller's session if `token` is valid, otherwise opens a
   * new one. Either way, announces the connection on the bus and replies
   * with the session's playerId/token so the client can persist it.
   */
  identify(ws: WebSocket, token?: string): void {
    const session = this.sessions.resumeOrOpen(ws, token);

    this.publisher.emit({
      type: CONNECTION_OPENED,
      playerId: session.playerId,
      ws,
      roomId: null,
    });

    Reply.send(ws, Reply.handshake(session.playerId, session.token));
  }

  /** Drops the session bound to this socket and announces the disconnect. */
  close(ws: WebSocket): void {
    const session = this.sessions.bySocket(ws);
    if (!session) return;

    this.sessions.drop(ws);

    this.publisher.emit({
      type: CONNECTION_CLOSED,
      playerId: session.playerId,
      ws,
      roomId: null,
    });
  }

  /** Heartbeat reply — no-op for now. */
  pong(_ws: WebSocket): void {}

  /** Sends a single notification to one socket. */
  send(ws: WebSocket, event: Notification): void {
    ws.send(this.protocol.encode(event));
  }

  /** Sends a single notification to many sockets. Encodes once, reuses for all recipients. */
  broadcast(event: Notification, recipients: WebSocket[]): void {
    const encoded = this.protocol.encode(event);
    for (const ws of recipients) {
      ws.send(encoded);
    }
  }
}
