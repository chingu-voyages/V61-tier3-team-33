import { describe, expect, it, mock } from "bun:test";

import { ErrorMessages, INVALID_PAYLOAD, NOT_IMPLEMENTED, SESSION_ERROR } from "../types";
import { type WebSocket, WS_OPEN } from "../types";
import { SESSION_HANDSHAKE } from "./commands";
import { Reply } from "./replies";

describe("Reply", () => {
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: () => {},
    };
  }

  describe("error", () => {
    it("sends the SESSION_ERROR type, code, and message to the socket", () => {
      const ws = makeSocket();
      Reply.error(ws, INVALID_PAYLOAD);

      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: SESSION_ERROR,
          code: INVALID_PAYLOAD,
          message: ErrorMessages[INVALID_PAYLOAD],
        }),
      );
    });

    it("carries whichever ErrorCode is passed in, unmodified", () => {
      const ws = makeSocket();
      Reply.error(ws, NOT_IMPLEMENTED);

      const sent = JSON.parse((ws.send as ReturnType<typeof mock>).mock.calls[0]![0] as string);
      expect(sent.code).toBe(NOT_IMPLEMENTED);
    });
  });

  describe("handshake", () => {
    it("sends the SESSION_HANDSHAKE type, playerId, and token to the socket", () => {
      const ws = makeSocket();
      Reply.handshake(ws, "player-1", "token-1");

      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: SESSION_HANDSHAKE,
          playerId: "player-1",
          token: "token-1",
        }),
      );
    });

    it("round-trips: what's sent parses back into the expected shape", () => {
      const ws = makeSocket();
      Reply.handshake(ws, "player-9", "token-9");

      const sent = JSON.parse((ws.send as ReturnType<typeof mock>).mock.calls[0]![0] as string);
      expect(sent).toEqual({
        type: SESSION_HANDSHAKE,
        playerId: "player-9",
        token: "token-9",
      });
    });
  });

  describe("send", () => {
    it("sends a handshake reply with JSON.stringify", () => {
      const ws = makeSocket();
      Reply.send(ws, {
        type: SESSION_HANDSHAKE,
        playerId: "player-1",
        token: "token-1",
      });

      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: SESSION_HANDSHAKE,
          playerId: "player-1",
          token: "token-1",
        }),
      );
    });

    it("sends an error reply with JSON.stringify", () => {
      const ws = makeSocket();
      Reply.send(ws, {
        type: SESSION_ERROR,
        code: INVALID_PAYLOAD,
        message: "bad payload",
      });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: SESSION_ERROR,
          code: INVALID_PAYLOAD,
          message: "bad payload",
        }),
      );
    });

    it("does not wrap the payload — plain JSON.stringify only", () => {
      const ws = makeSocket();
      const reply = { type: SESSION_ERROR, code: NOT_IMPLEMENTED, message: "nope" } as const;
      Reply.send(ws, reply);

      const sent = (ws.send as ReturnType<typeof mock>).mock.calls[0]![0];
      expect(sent).toBe(JSON.stringify(reply));
    });
  });
});
