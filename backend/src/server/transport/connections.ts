import type { WebSocket } from "../types";
import type { Publisher } from "../bus/bus";
import type { Codec } from "../codec/codec";
import type { SessionStore } from "../session/session-store";
import type { Session } from "../session/session";
import type { Notification } from "../protocol/events";
import { Signals, Notifications } from "../protocol/events";
import { Reply } from "../protocol/replies";
import { Grace } from "../util/grace";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Connections" });

/** How long the disconnected player has to reconnect before the game is abandoned. */
const GRACE_TIMEOUT_MS = 30 * 1000;

/**
 * Owns the connection lifecycle: handshake (resume-or-open a session),
 * disconnect, heartbeat, and outbound delivery.
 * Gateway decodes the wire command and routes it here; Connections is what
 * actually touches sessions, the Hub, and the socket.
 */
export class Connections {
  private grace = new Grace();

  constructor(
    private sessions: SessionStore,
    private publisher: Publisher,
    private protocol: Codec,
    private graceTimeoutMs: number = GRACE_TIMEOUT_MS,
  ) {}

  /**
   * Resumes the caller's session if `token` is valid, otherwise opens a
   * new one. Either way, announces the connection on the bus and replies
   * with the session's playerId/token so the client can persist it.
   * If this is a resume (reconnect), cancels any grace timer for the player.
   */
  identify(ws: WebSocket, token?: string): Session {
    const session = this.sessions.resumeOrOpen(ws, token);

    // Cancel any grace timer if this is a reconnecting player
    if (token) {
      this.grace.cancel(session.playerId);
    }

    log.info("connection identified", {
      playerId: session.playerId,
      resumed: Boolean(token),
    });

    this.publisher.emit(Signals.connectionOpened(session.playerId, ws));

    Reply.send(ws, Reply.handshake(session.playerId, session.token));

    return session;
  }

  /** Drops the session bound to this socket and announces the disconnect. */
  close(ws: WebSocket): void {
    const session = this.sessions.bySocket(ws);
    if (!session) return;

    const capturedPlayerId = session.playerId;
    const capturedRoomId = session.roomId;
    const capturedColor = session.color;

    this.sessions.drop(ws);

    log.info("connection closed", { playerId: capturedPlayerId });

    this.publisher.emit(Signals.connectionClosed(capturedPlayerId, ws));

    // Start grace timer if the player was in a room — the Hub will
    // notify GameService on expiry so it can abandon the game.
    if (capturedRoomId !== null && capturedColor !== null) {
      this.grace.start(
        capturedPlayerId,
        capturedColor,
        this.graceTimeoutMs,
        () => {
          this.publisher.emit(
            Notifications.graceExpired(capturedRoomId, capturedColor),
          );
        },
      );
    }
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
