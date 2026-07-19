import { describe, expect, it, mock } from "bun:test";

import type { Notification } from "../protocol/events";
import { ROOM_JOINED } from "../protocol/events";
import { ACTIVE, HUMAN, IN_PROGRESS, NO_DRAW_REASON, RULES, type WebSocket, WHITE, WS_OPEN } from "../types";
import { Human } from "./human";

function makeWs(): WebSocket {
  return {
    id: crypto.randomUUID(),
    readyState: WS_OPEN,
    send: mock(() => {}),
    close: () => {},
  };
}

function makeNotification(): Notification {
  return {
    type: ROOM_JOINED,
    roomId: "room-1",
    color: WHITE,
    state: {
      status: ACTIVE,
      moveSeq: 0,
      fen: "fen",
      turn: WHITE,
      isCheck: false,
      resultStatus: IN_PROGRESS,
      winner: WHITE,
      hasWinner: false,
      drawReason: NO_DRAW_REASON,
      endReason: RULES,
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
    const h = new Human("p1", ws);

    expect(h.playerId).toBe("p1");
    expect(h.kind).toBe(HUMAN);
  });

  describe("notify", () => {
    it("encodes the notification as JSON and sends it over the socket", () => {
      const ws = makeWs();
      const notification = makeNotification();
      const h = new Human("p1", ws);

      h.notify(notification);

      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(notification));
    });
  });

  describe("replaceSocket", () => {
    it("returns a new Human bound to the new socket", () => {
      const oldWs = makeWs();
      const newWs = makeWs();
      const h = new Human("p1", oldWs);

      const replaced = h.replaceSocket(newWs);

      expect(replaced.playerId).toBe("p1");
      expect(replaced).not.toBe(h);
    });

    it("does not mutate the original Human instance (immutable)", () => {
      const oldWs = makeWs();
      const newWs = makeWs();
      const h = new Human("p1", oldWs);

      h.replaceSocket(newWs);

      const notification = makeNotification();
      h.notify(notification);
      expect(oldWs.send).toHaveBeenCalled();
    });

    it("sends notifications through the new socket after replace", () => {
      const oldWs = makeWs();
      const newWs = makeWs();
      const h = new Human("p1", oldWs);

      const replaced = h.replaceSocket(newWs);
      const notification = makeNotification();
      replaced.notify(notification);

      expect(newWs.send).toHaveBeenCalled();
      expect(oldWs.send).not.toHaveBeenCalled();
    });
  });
});
