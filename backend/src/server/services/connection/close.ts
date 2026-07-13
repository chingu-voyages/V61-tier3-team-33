import { logger as rootLogger } from "../../../logging/logger";
import type { Publisher } from "../../events/hub";
import { Notifications, Signals } from "../../protocol/events";
import type { SessionStore } from "../../store/session/session-store";
import type { WebSocket } from "../../types";
import type { Grace } from "../../util/grace";

const log = rootLogger.child({ module: "CloseCommand" });

export class CloseCommand {
  constructor(
    private sessions: SessionStore,
    private publisher: Publisher,
    private grace: Grace,
    private graceTimeoutMs: number,
  ) {}

  run(ws: WebSocket): void {
    // lookup session
    const session = this.sessions.bySocket(ws);
    if (!session) {
      log.warn("[CloseCommand.run:miss]", { wsId: ws.id });
      return;
    }

    // capture session state
    const capturedPlayerId = session.playerId;
    const capturedRoomId = session.roomId;
    const capturedColor = session.color;

    // drop session
    this.sessions.drop(ws);

    // emit signal
    this.publisher.emit(Signals.connectionClosed(capturedPlayerId, ws));

    // start grace period
    if (capturedRoomId !== null && capturedColor !== null) {
      this.grace.start(capturedPlayerId, capturedColor, this.graceTimeoutMs, () => {
        this.publisher.emit(Notifications.graceExpired(capturedRoomId, capturedColor));
      });
    }
  }
}
