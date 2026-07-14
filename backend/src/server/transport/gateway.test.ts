import { describe, expect, it, mock } from "bun:test";

import { setCodec } from "../codec/codec";
import { JsonCodec } from "../codec/json";
import type { Command } from "../protocol/commands";
import { HUMAN_VS_HUMAN, type WebSocket, WHITE, WS_OPEN } from "../types";
import { INVALID_PAYLOAD, NOT_IMPLEMENTED, ROOM_NOT_FOUND } from "../types";
import { Gateway } from "./gateway";

type GatewayPrivate = { handleMessage(ws: WebSocket, data: unknown): void; handleClose(ws: WebSocket): void };
type RawMessage = Record<string, unknown>;

function makeSocket(): WebSocket {
  return {
    id: crypto.randomUUID(),
    readyState: WS_OPEN,
    send: mock(() => {}),
    close: () => {},
  };
}

function sent(ws: WebSocket): RawMessage[] {
  return (ws.send as ReturnType<typeof mock>).mock.calls.map(
    (call: unknown[]) => JSON.parse(call[0] as string) as RawMessage,
  );
}

function lastSent(ws: WebSocket): RawMessage {
  const msgs = sent(ws);
  return msgs[msgs.length - 1]!;
}

function gatewayWithMocks(codec: JsonCodec) {
  setCodec(codec);
  return new Gateway();
}

function realGateway() {
  setCodec(new JsonCodec());
  return { gw: new Gateway() };
}

function handshake(gw: Gateway, ws: WebSocket): string {
  (gw as unknown as GatewayPrivate).handleMessage(ws, { type: "session:handshake" });
  const msgs = sent(ws);
  const hs = msgs.find((m) => (m as RawMessage).type === "session:handshake");
  return (hs as RawMessage).token as string;
}

function join(gw: Gateway, ws: WebSocket, overrides: Record<string, unknown> = {}) {
  (gw as unknown as GatewayPrivate).handleMessage(ws, {
    type: "room:join",
    mode: HUMAN_VS_HUMAN,
    ...overrides,
  });
}

function lastEventOfType(ws: WebSocket, type: string): RawMessage | undefined {
  const msgs = sent(ws);
  const matches = msgs.filter((m) => (m as RawMessage).type === type);
  return matches[matches.length - 1];
}

function drain(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

async function setupTwoPlayerGame(gw: Gateway): Promise<{ wsA: WebSocket; wsB: WebSocket; roomId: string }> {
  const wsA = makeSocket();
  const wsB = makeSocket();

  handshake(gw, wsA);
  join(gw, wsA);
  await drain();
  const aJoined = lastEventOfType(wsA, "room:joined")!;
  const roomId = aJoined.roomId as string;

  handshake(gw, wsB);
  join(gw, wsB, { roomId });
  await drain();

  return { wsA, wsB, roomId };
}

describe("Gateway handleMessage", () => {
  describe("error path — decode failure", () => {
    it("sends INVALID_PAYLOAD when protocol.decode returns null", () => {
      const codec = { decode: mock(() => null), encode: mock((msg: unknown) => JSON.stringify(msg)) } as JsonCodec;
      const gw = gatewayWithMocks(codec);
      const ws = makeSocket();

      (gw as unknown as GatewayPrivate).handleMessage(ws, "garbage");

      const reply = lastSent(ws);
      expect(reply.type).toBe("session:error");
      expect(reply.code).toBe(INVALID_PAYLOAD);
    });

    it("does not call gameService when decode fails", () => {
      const codec = { decode: mock(() => null), encode: mock((msg: unknown) => JSON.stringify(msg)) } as JsonCodec;
      const gw = gatewayWithMocks(codec);
      const ws = makeSocket();

      (gw as unknown as GatewayPrivate).handleMessage(ws, "garbage");

      expect(sent(ws)).toHaveLength(1);
    });

    it("rejects a join request with out-of-domain numeric values", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      (gw as unknown as GatewayPrivate).handleMessage(ws, {
        type: "room:join",
        mode: 99,
        color: 42,
      });

      const reply = lastSent(ws);
      expect(reply).toMatchObject({ type: "session:error", code: INVALID_PAYLOAD });
    });
  });

  describe("error path — unknown command type", () => {
    it("sends NOT_IMPLEMENTED for unrecognised command type", () => {
      const codec = {
        decode: (raw: unknown) => {
          if (raw && typeof raw === "object" && "type" in (raw as Record<string, unknown>)) {
            return raw as Command;
          }
          return null;
        },
        encode: (msg: unknown) => JSON.stringify(msg),
      } as JsonCodec;
      setCodec(codec);
      const gw = new Gateway();
      const ws = makeSocket();

      handshake(gw, ws);
      (gw as unknown as GatewayPrivate).handleMessage(ws, { type: "bogus:cmd" });

      const reply = lastSent(ws);
      expect(reply.type).toBe("session:error");
      expect(reply.code).toBe(NOT_IMPLEMENTED);
    });
  });

  describe("SESSION_HANDSHAKE routing", () => {
    it("returns a handshake reply for a fresh session", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      (gw as unknown as GatewayPrivate).handleMessage(ws, { type: "session:handshake" });

      const reply = lastSent(ws);
      expect(reply.type).toBe("session:handshake");
      expect(reply.playerId).toBeTruthy();
      expect(reply.token).toBeTruthy();
    });

    it("returns a handshake reply when resuming with a valid token", () => {
      const { gw } = realGateway();
      const ws = makeSocket();

      (gw as unknown as GatewayPrivate).handleMessage(ws, { type: "session:handshake" });
      const firstReply = lastSent(ws);
      const token = firstReply.token;

      const ws2 = makeSocket();
      (gw as unknown as GatewayPrivate).handleMessage(ws2, {
        type: "session:handshake",
        token,
      });

      const reply = lastSent(ws2);
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

      const msgs = sent(ws);
      const joined = msgs.find((m) => m.type === "room:joined");
      expect(joined).toBeTruthy();
      expect(joined!.roomId).toBeTruthy();
      expect(joined!.color).toBe(WHITE);
    });

    it("seats two players and starts a game", async () => {
      const { gw } = realGateway();
      const { wsA, wsB, roomId } = await setupTwoPlayerGame(gw);

      const aStarted = lastEventOfType(wsA, "game:started");
      expect(aStarted).toBeTruthy();
      expect(aStarted!.roomId).toBe(roomId);

      const bJoined = lastEventOfType(wsB, "room:joined");
      expect(bJoined).toBeTruthy();
      const bStarted = lastEventOfType(wsB, "game:started");
      expect(bStarted).toBeTruthy();
    });
  });

  it("returns ROOM_NOT_FOUND when an explicit roomId does not match any existing game", async () => {
    const { gw } = realGateway();
    const waitingPlayer = makeSocket();

    handshake(gw, waitingPlayer);
    join(gw, waitingPlayer);
    await drain();

    const joiner = makeSocket();
    handshake(gw, joiner);
    join(gw, joiner, { roomId: "screening-id" });
    await drain();

    const lastMsg = lastSent(joiner);
    expect(lastMsg.type).toBe("session:error");
    expect(lastMsg.code).toBe(ROOM_NOT_FOUND);
  });

  describe("auto-rejoin on reconnect", () => {
    it("re-joins the room when a reconnecting socket sends SESSION_HANDSHAKE", async () => {
      const { gw } = realGateway();
      const wsA = makeSocket();

      const token = handshake(gw, wsA);
      join(gw, wsA);
      await drain();
      const aJoined = lastEventOfType(wsA, "room:joined")!;
      expect(aJoined).toBeTruthy();

      (gw as unknown as GatewayPrivate).handleClose(wsA);

      const wsB = makeSocket();
      (gw as unknown as GatewayPrivate).handleMessage(wsB, {
        type: "session:handshake",
        token,
      });
      await drain();

      const bMessages = sent(wsB);
      const bHandshake = bMessages.find((m) => m.type === "session:handshake");
      expect(bHandshake).toBeTruthy();

      const bJoined = bMessages.find((m) => m.type === "room:joined" || m.type === "game:started");
      expect(bJoined).toBeTruthy();
    });
  });

  describe("MOVE_MAKE routing", () => {
    it("applies a move through the full gateway path", async () => {
      const { gw } = realGateway();
      const { wsA } = await setupTwoPlayerGame(gw);

      (gw as unknown as GatewayPrivate).handleMessage(wsA, {
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

      (gw as unknown as GatewayPrivate).handleMessage(ws, {
        type: "move:make",
        from: 33,
        to: 35,
      });

      const messages = sent(ws);
      const error = messages.find((m) => m.type === "session:error");
      expect(error).toBeTruthy();
    });
  });

  describe("GAME_RESIGN routing", () => {
    it("resigns through the full gateway path", async () => {
      const { gw } = realGateway();
      const { wsA, wsB } = await setupTwoPlayerGame(gw);

      (gw as unknown as GatewayPrivate).handleMessage(wsA, { type: "game:resign" });
      await drain();

      const aOver = lastEventOfType(wsA, "game:ended");
      expect(aOver).toBeTruthy();
      const bOver = lastEventOfType(wsB, "game:ended");
      expect(bOver).toBeTruthy();
    });
  });

  describe("STATE_SYNC routing", () => {
    it("returns game state through the full gateway path", async () => {
      const { gw } = realGateway();
      const { wsA } = await setupTwoPlayerGame(gw);

      (gw as unknown as GatewayPrivate).handleMessage(wsA, { type: "state:sync" });

      const state = lastEventOfType(wsA, "room:joined");
      expect(state).toBeTruthy();
      expect(state).toHaveProperty("state");
      expect(state!.state).toHaveProperty("fen");
    });
  });

  describe("ROOM_LEAVE routing", () => {
    it("handles ROOM_LEAVE through the full gateway path", async () => {
      const { gw } = realGateway();
      const { wsA, wsB } = await setupTwoPlayerGame(gw);

      (gw as unknown as GatewayPrivate).handleMessage(wsA, { type: "room:leave" });

      const aLeft = lastEventOfType(wsA, "room:left");
      expect(aLeft).toBeTruthy();
      const bLeft = lastEventOfType(wsB, "room:left");
      expect(bLeft).toBeTruthy();
    });
  });
});
