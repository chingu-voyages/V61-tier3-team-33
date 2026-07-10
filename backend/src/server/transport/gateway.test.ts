import { describe, expect, it, mock } from "bun:test";
import { Gateway } from "./gateway";
import { JsonCodec } from "../codec/json";
import { Sessions } from "../session/sessions";
import { Games } from "../game/games";
import { Hub } from "../bus/bus";
import {
  WS_OPEN,
  HUMAN_VS_HUMAN,
  WHITE,
  BLACK,
  type WebSocket,
} from "../types";
import type { Codec } from "../codec/codec";
import type { Command } from "../protocol/commands";
import { INVALID_PAYLOAD, NOT_IMPLEMENTED } from "../protocol/errors";

function makeSocket(): WebSocket {
  return {
    id: crypto.randomUUID(),
    readyState: WS_OPEN,
    send: mock(() => {}),
    close: () => {},
  };
}

function sent(ws: WebSocket): unknown[] {
  return (ws.send as ReturnType<typeof mock>).mock.calls.map(
    (call: unknown[]) => JSON.parse(call[0] as string),
  );
}

function lastSent(ws: WebSocket): unknown {
  const msgs = sent(ws);
  return msgs[msgs.length - 1];
}

function gatewayWithMocks(codec: Codec) {
  return new Gateway(codec);
}

function realGateway() {
  const hub = new Hub();
  const sessions = new Sessions();
  const games = new Games(hub);
  const codec = new JsonCodec();
  const gw = new Gateway(codec, sessions, hub, games);
  return { gw, hub, sessions, games, codec };
}

function handshake(gw: Gateway, ws: WebSocket): string {
  (gw as any).handleMessage(ws, { type: "session:handshake" });
  const msgs = sent(ws) as any[];
  const hs = msgs.find((m: any) => m.type === "session:handshake");
  return hs!.token as string;
}

function join(gw: Gateway, ws: WebSocket, overrides: Record<string, unknown> = {}) {
  (gw as any).handleMessage(ws, {
    type: "room:join",
    mode: HUMAN_VS_HUMAN,
    ...overrides,
  });
}

function lastEventOfType(ws: WebSocket, type: string): unknown {
  const msgs = sent(ws) as any[];
  const matches = msgs.filter((m: any) => m.type === type);
  return matches[matches.length - 1];
}

/** Drains the microtask queue so async GameService methods can finish. */
function drain(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function setupTwoPlayerGame(gw: Gateway): { wsA: WebSocket; wsB: WebSocket; roomId: string } {
  const wsA = makeSocket();
  const wsB = makeSocket();

  handshake(gw, wsA);
  join(gw, wsA);
  const aJoined = lastEventOfType(wsA, "room:joined") as any;
  const roomId = aJoined.roomId;

  handshake(gw, wsB);
  join(gw, wsB, { roomId });

  return { wsA, wsB, roomId };
}

describe("Gateway handleMessage", () => {
  describe("error path — decode failure", () => {
    it("sends INVALID_PAYLOAD when protocol.decode returns null", () => {
      const codec: Codec = {
        decode: mock(() => null),
        encode: mock(() => "{}"),
      };
      const gw = gatewayWithMocks(codec);
      const ws = makeSocket();

      (gw as any).handleMessage(ws, "garbage");

      const reply = lastSent(ws) as any;
      expect(reply.type).toBe("session:error");
      expect(reply.code).toBe(INVALID_PAYLOAD);
    });

    it("does not call gameService when decode fails", () => {
      const codec: Codec = {
        decode: mock(() => null),
        encode: mock(() => "{}"),
      };
      const gw = gatewayWithMocks(codec);
      const ws = makeSocket();

      (gw as any).handleMessage(ws, "garbage");

      expect(sent(ws)).toHaveLength(1);
    });
  });

  describe("error path — unknown command type", () => {
    it("sends NOT_IMPLEMENTED for unrecognised command type", () => {
      const codec: Codec = {
        decode: mock(() => ({ type: "bogus:cmd" }) as unknown as Command),
        encode: mock(() => "{}"),
      };
      const gw = gatewayWithMocks(codec);
      const ws = makeSocket();

      (gw as any).handleMessage(ws, '{"type":"bogus:cmd"}');

      const reply = lastSent(ws) as any;
      expect(reply.type).toBe("session:error");
      expect(reply.code).toBe(NOT_IMPLEMENTED);
    });
  });

  describe("SESSION_HANDSHAKE routing", () => {
    it("returns a handshake reply for a fresh session", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      (gw as any).handleMessage(ws, { type: "session:handshake" });

      const reply = lastSent(ws) as any;
      expect(reply.type).toBe("session:handshake");
      expect(reply.playerId).toBeTruthy();
      expect(reply.token).toBeTruthy();
    });

    it("returns a handshake reply when resuming with a valid token", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      (gw as any).handleMessage(ws, { type: "session:handshake" });
      const firstReply = lastSent(ws) as any;
      const token = firstReply.token;

      const ws2 = makeSocket();
      (gw as any).handleMessage(ws2, {
        type: "session:handshake",
        token,
      });

      const reply = lastSent(ws2) as any;
      expect(reply.type).toBe("session:handshake");
      expect(reply.playerId).toBe(firstReply.playerId);
    });
  });

  describe("ROOM_JOIN routing", () => {
    it("creates a room and seats the first player", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      handshake(gw, ws);
      join(gw, ws);

      const msgs = sent(ws) as any[];
      const joined = msgs.find((m: any) => m.type === "room:joined");
      expect(joined).toBeTruthy();
      expect((joined as any).roomId).toBeTruthy();
      expect((joined as any).color).toBe(WHITE);
    });

    it("seats two players and starts a game", () => {
      const { gw } = realGateway();
      const { wsA, wsB, roomId } = setupTwoPlayerGame(gw);

      const aStarted = lastEventOfType(wsA, "game:started");
      expect(aStarted).toBeTruthy();
      expect((aStarted as any).roomId).toBe(roomId);

      const bJoined = lastEventOfType(wsB, "room:joined");
      expect(bJoined).toBeTruthy();
      const bStarted = lastEventOfType(wsB, "game:started");
      expect(bStarted).toBeTruthy();
    });
  });

  describe("auto-rejoin on reconnect", () => {
    it("re-joins the room when a reconnecting socket sends SESSION_HANDSHAKE", () => {
      const { gw } = realGateway();
      const wsA = makeSocket();

      const token = handshake(gw, wsA);
      join(gw, wsA);
      const aJoined = lastEventOfType(wsA, "room:joined") as any;
      expect(aJoined).toBeTruthy();

      // Disconnect socket A
      (gw as any).handleClose(wsA);

      // Reconnect with a new socket using the session token
      const wsB = makeSocket();
      (gw as any).handleMessage(wsB, {
        type: "session:handshake",
        token,
      });

      // The new socket should receive a handshake reply AND game state
      const bMessages = sent(wsB) as any[];
      const bHandshake = bMessages.find(
        (m: any) => m.type === "session:handshake",
      );
      expect(bHandshake).toBeTruthy();

      // Auto-rejoin delivers a room:joined or game:started event
      const bJoined = bMessages.find(
        (m: any) => m.type === "room:joined" || m.type === "game:started",
      );
      expect(bJoined).toBeTruthy();
    });
  });

  describe("MOVE_MAKE routing", () => {
    it("applies a move through the full gateway path", async () => {
      const { gw } = realGateway();
      const { wsA } = setupTwoPlayerGame(gw);

      // e2-e4 (file*8+rank: E2=4*8+1=33, E4=4*8+3=35)
      (gw as any).handleMessage(wsA, {
        type: "move:make",
        from: 33,
        to: 35,
      });
      await drain();

      const moved = lastEventOfType(wsA, "move:made");
      expect(moved).toBeTruthy();
    });

    it("rejects a move when player is not in a game", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      handshake(gw, ws);

      (gw as any).handleMessage(ws, {
        type: "move:make",
        from: 33,
        to: 35,
      });

      const messages = sent(ws) as any[];
      const error = messages.find((m: any) => m.type === "session:error");
      expect(error).toBeTruthy();
    });
  });

  describe("GAME_RESIGN routing", () => {
    it("resigns through the full gateway path", async () => {
      const { gw } = realGateway();
      const { wsA, wsB } = setupTwoPlayerGame(gw);

      (gw as any).handleMessage(wsA, { type: "game:resign" });
      await drain();

      const aOver = lastEventOfType(wsA, "game:ended");
      expect(aOver).toBeTruthy();
      const bOver = lastEventOfType(wsB, "game:ended");
      expect(bOver).toBeTruthy();
    });
  });

  describe("STATE_SYNC routing", () => {
    it("returns game state through the full gateway path", () => {
      const { gw } = realGateway();
      const { wsA } = setupTwoPlayerGame(gw);

      (gw as any).handleMessage(wsA, { type: "state:sync" });

      const state = lastEventOfType(wsA, "room:joined");
      expect(state).toBeTruthy();
      expect((state as any)).toHaveProperty("state");
      expect((state as any).state).toHaveProperty("fen");
    });
  });

  describe("ROOM_LEAVE routing", () => {
    it("handles ROOM_LEAVE through the full gateway path", () => {
      const { gw } = realGateway();
      const { wsA, wsB } = setupTwoPlayerGame(gw);

      // Player A leaves
      (gw as any).handleMessage(wsA, { type: "room:leave" });

      const aLeft = lastEventOfType(wsA, "room:left");
      expect(aLeft).toBeTruthy();
      const bLeft = lastEventOfType(wsB, "room:left");
      expect(bLeft).toBeTruthy();
    });
  });
});
