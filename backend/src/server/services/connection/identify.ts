import type { Publisher } from "../../events/hub";
import { Signals } from "../../protocol/events";
import { Reply } from "../../protocol/replies";
import type { SessionStore } from "../../store/session/session-store";
import type { PlayerContext, WebSocket } from "../../types";
import type { Grace } from "../../util/grace";

export class IdentifyCommand {
  constructor(
    private sessions: SessionStore,
    private publisher: Publisher,
    private grace: Grace,
  ) {}

  run(ws: WebSocket, token?: string): PlayerContext {
    // resume session
    const session = this.sessions.resumeOrOpen(ws, token);
    // cancel grace timer
    this.grace.cancel(session.playerId);
    // emit signal
    this.publisher.emit(Signals.connectionOpened(session.playerId, ws));
    // handshake reply
    Reply.handshake(ws, session.playerId, session.token);
    return {
      playerId: session.playerId,
      roomId: session.roomId,
      color: session.color,
      mode: session.mode,
    };
  }
}
