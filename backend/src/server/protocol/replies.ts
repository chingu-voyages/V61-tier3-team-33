import { SESSION_HANDSHAKE } from "./commands";
import { SESSION_ERROR } from "./errors";
import type { ErrorCode } from "./errors";
import type { WebSocket } from "../types";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Replies" });

export type { ErrorCode };

export interface HandshakeReply {
  type: typeof SESSION_HANDSHAKE;
  playerId: string;
  token: string;
}

export interface ErrorReply {
  type: typeof SESSION_ERROR;
  code: ErrorCode;
  message: string;
}

export type Reply = HandshakeReply | ErrorReply;

export const Reply = {
  handshake(playerId: string, token: string): HandshakeReply {
    return { type: SESSION_HANDSHAKE, playerId, token };
  },

  error(code: ErrorCode, message: string): ErrorReply {
    return { type: SESSION_ERROR, code, message };
  },

  /** Serializes and sends a Reply directly over the socket. Replies are
   * hand-serialized (unlike Notification, which goes through
   * Protocol.encode) since they're protocol-level, not player-facing
   * game events, so there's no need to route them through a swappable
   * wire format. */
  send(ws: WebSocket, reply: Reply): void {
    const msg = JSON.stringify(reply);
    if (reply.type === SESSION_ERROR) {
      log.warn("[REPLY-error]", { code: reply.code, message: reply.message, wsId: (ws as any).id });
    } else {
      log.info("[REPLY-send]", { type: reply.type, wsId: (ws as any).id });
    }
    ws.send(msg);
  },
};
