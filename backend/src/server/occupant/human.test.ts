import { describe, expect, it, mock } from "bun:test";
import { Human } from "./human";
import { WHITE, WS_OPEN, HUMAN, type WebSocket } from "../types";
import { ROOM_JOINED } from "../protocol/events";
import type { Codec } from "../codec/codec";
import type { Notification } from "../protocol/events";

function makeWs(): WebSocket {
  return {
    id: crypto.randomUUID(),
    readyState: WS_OPEN,
    send: mock(() => {}),
    close: () => {},
  };
}

function makeCodec(): Codec {
  return {
    decode: mock(() => null),
    encode: mock((event: Notification) => JSON.stringify(event)),
  };
}

function makeNotification(): Notification {
  return {
    type: ROOM_JOINED,
    roomId: "room-1",
    color: WHITE,
    state: {
      status: 1 as any,
      fen: "fen",
      turn: WHITE,
      isCheck: false,
      resultStatus: 0 as any,
      winner: WHITE as any,
      hasWinner: false,
      drawReason: 0 as any,
      endReason: 0 as any,
      history: [],
      capturedByWhite: [],
      capturedByBlack: [],
      clock: null,
    },
  };
}

describe("Human", () => {
  it("exposes playerId and kind", () => {
    const ws = makeWs();
    const codec = makeCodec();
    const h = new Human("p1", ws, codec);

    expect(h.playerId).toBe("p1");
    expect(h.kind).toBe(HUMAN);
  });

  describe("notify", () => {
    it("encodes the notification via the codec and sends it over the socket", () => {
      const ws = makeWs();
      const codec = makeCodec();
      const notification = makeNotification();
      const h = new Human("p1", ws, codec);

      h.notify(notification);

      expect(codec.encode).toHaveBeenCalledTimes(1);
      expect(codec.encode).toHaveBeenCalledWith(notification);
      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(notification));
    });
  });

  describe("replaceSocket", () => {
    it("returns a new Human bound to the new socket", () => {
      const oldWs = makeWs();
      const newWs = makeWs();
      const codec = makeCodec();
      const h = new Human("p1", oldWs, codec);

      const replaced = h.replaceSocket(newWs);

      expect(replaced.playerId).toBe("p1");
      expect(replaced).not.toBe(h);
    });

    it("does not mutate the original Human instance (immutable)", () => {
      const oldWs = makeWs();
      const newWs = makeWs();
      const codec = makeCodec();
      const h = new Human("p1", oldWs, codec);

      h.replaceSocket(newWs);

      // original should still use old socket
      const notification = makeNotification();
      h.notify(notification);
      expect(oldWs.send).toHaveBeenCalled();
    });

    it("preserves playerId and codec on the new instance", () => {
      const codec = makeCodec();
      const h = new Human("p1", makeWs(), codec);

      const replaced = h.replaceSocket(makeWs());

      expect(replaced.playerId).toBe("p1");
      expect((replaced as any).protocol).toBe(codec);
    });

    it("sends notifications through the new socket after replace", () => {
      const oldWs = makeWs();
      const newWs = makeWs();
      const codec = makeCodec();
      const h = new Human("p1", oldWs, codec);

      const replaced = h.replaceSocket(newWs);
      const notification = makeNotification();
      replaced.notify(notification);

      expect(newWs.send).toHaveBeenCalled();
      expect(oldWs.send).not.toHaveBeenCalled();
    });
  });
})
