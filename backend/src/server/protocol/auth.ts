import { logger as rootLogger } from "../../logging/logger";
import type { SessionStore } from "../store/session/session-store";
import type { PlayerContext, WebSocket } from "../types";
import { NOT_AUTHENTICATED } from "../types";
import { Reply } from "./replies";

const log = rootLogger.child({ module: "Auth" });

export class Auth {
  constructor(private sessions: SessionStore) {
    // log auth initialization
    log.info("[Auth.constructor:init]");
  }

  /** Look up the session, or send an auth error and return null. */
  resolve(ws: WebSocket): PlayerContext | null {
    // look up session by websocket
    const session = this.sessions.bySocket(ws);
    if (!session) {
      log.warn("[Auth.resolve:not-authenticated]", { wsId: ws.id });
      Reply.error(ws, NOT_AUTHENTICATED);
      return null;
    }

    // log and return resolved player context
    log.info("[Auth.resolve:resolved]", {
      playerId: session.playerId,
      roomId: session.roomId,
      color: session.color,
      mode: session.mode,
    });
    return {
      playerId: session.playerId,
      roomId: session.roomId,
      color: session.color,
      mode: session.mode,
    };
  }
}
