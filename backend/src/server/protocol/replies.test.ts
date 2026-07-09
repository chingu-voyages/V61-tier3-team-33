import { describe, expect, it, mock } from "bun:test";
import { Reply } from "./replies";
import { SESSION_HANDSHAKE } from "./commands";
import { SESSION_ERROR, INVALID_PAYLOAD, NOT_IMPLEMENTED } from "./errors";
import { WS_OPEN, type WebSocket } from "../types";

describe("Reply", () => {
  /** A minimal fake WebSocket. Each call makes a distinct object, so two
   * fakes are never === even if constructed identically. */
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: () => {},
    };
  }

  describe("handshake", () => {
    it("builds a reply carrying the SESSION_HANDSHAKE type, playerId, and token", () => {
      const reply = Reply.handshake("player-1", "token-1");

      expect(reply).toEqual({
        type: SESSION_HANDSHAKE,
        playerId: "player-1",
        token: "token-1",
      });
    });

    it("keeps playerId and token distinct even when called repeatedly", () => {
      const first = Reply.handshake("player-1", "token-1");
      const second = Reply.handshake("player-2", "token-2");

      expect(first).not.toEqual(second);
    });
  });

  describe("error", () => {
    it("builds a reply carrying the SESSION_ERROR type, the given code, and message", () => {
      const reply = Reply.error(
        INVALID_PAYLOAD,
        "Unparseable or unknown command.",
      );

      expect(reply).toEqual({
        type: SESSION_ERROR,
        code: INVALID_PAYLOAD,
        message: "Unparseable or unknown command.",
      });
    });

    it("carries whichever ErrorCode is passed in, unmodified", () => {
      const reply = Reply.error(NOT_IMPLEMENTED, "not yet implemented");

      expect(reply.code).toBe(NOT_IMPLEMENTED);
    });
  });

  describe("send", () => {
    it("hand-serializes a handshake reply with JSON.stringify and writes it to the socket", () => {
      const ws = makeSocket();
      const reply = Reply.handshake("player-1", "token-1");

      Reply.send(ws, reply);

      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(reply));
    });

    it("hand-serializes an error reply with JSON.stringify and writes it to the socket", () => {
      const ws = makeSocket();
      const reply = Reply.error(INVALID_PAYLOAD, "bad payload");

      Reply.send(ws, reply);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(reply));
    });

    it("round-trips: what's sent parses back into an equivalent reply", () => {
      const ws = makeSocket();
      const reply = Reply.handshake("player-9", "token-9");

      Reply.send(ws, reply);

      const sent = (ws.send as any).mock.calls[0][0];
      expect(JSON.parse(sent)).toEqual(reply);
    });

    it("does not go through any encode/protocol layer — plain JSON.stringify only", () => {
      const ws = makeSocket();
      const reply = Reply.error(NOT_IMPLEMENTED, "nope");

      Reply.send(ws, reply);

      // A hand-rolled protocol.encode would typically add nothing extra here,
      // so this mainly locks in that Reply.send's output is exactly
      // JSON.stringify(reply) and nothing else (no wrapping, no envelope).
      const sent = (ws.send as any).mock.calls[0][0];
      expect(sent).toBe(JSON.stringify(reply));
    });
  });
});
