import { logger as rootLogger } from "../../logging/logger";
import { getCodec } from "../codec/codec";
import type { WebSocket } from "../types";
import { type ErrorCode, ErrorMessages, INTERNAL_ERROR, SESSION_ERROR } from "../types";
import { SESSION_HANDSHAKE } from "./commands";

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

export type ReplyData = HandshakeReply | ErrorReply;

export const Reply = {
  /** Send an error directly to the socket. */
  error(ws: WebSocket, code: ErrorCode): void {
    // build and send error reply
    Reply.send(ws, { type: SESSION_ERROR, code, message: ErrorMessages[code] ?? ErrorMessages[INTERNAL_ERROR]! });
  },

  /** Send any reply to the socket. */
  send(ws: WebSocket, reply: ReplyData): void {
    // log the reply being sent
    if (reply.type === SESSION_ERROR) {
      log.warn("[Reply.send:error]", { code: reply.code, message: reply.message, wsId: ws.id });
    } else {
      log.info("[Reply.send:sent]", { type: reply.type, wsId: ws.id });
    }

    // encode and transmit the reply
    ws.send(getCodec().encode(reply));
  },

  /** Send the session handshake to the socket. */
  handshake(ws: WebSocket, playerId: string, token: string): void {
    // log and send session handshake
    log.info("[Reply.handshake:sending]", { playerId: playerId.slice(0, 8), wsId: ws.id });
    Reply.send(ws, { type: SESSION_HANDSHAKE, playerId, token });
  },
};
