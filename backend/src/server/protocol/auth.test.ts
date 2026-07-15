import { describe, expect, it, mock } from "bun:test";

import { Sessions } from "../store/session/sessions";
import type { WebSocket } from "../types";
import { HUMAN_VS_HUMAN, NOT_AUTHENTICATED, SESSION_ERROR, WHITE, WS_OPEN } from "../types";
import { Auth } from "./auth";

function makeSocket(id: string): WebSocket {
  return { id, readyState: WS_OPEN, send: mock(() => {}), close: mock(() => {}) } as unknown as WebSocket;
}

type SentMessage = Record<string, unknown>;

function sent(ws: WebSocket): SentMessage[] {
  return (ws.send as ReturnType<typeof mock>).mock.calls.map(
    (c: unknown[]) => JSON.parse(c[0] as string) as SentMessage,
  );
}

describe("Auth", () => {
  it("returns null and sends error when no session exists", () => {
    const sessions = new Sessions();
    const auth = new Auth(sessions);
    const ws = makeSocket("no-session");

    const result = auth.resolve(ws);

    expect(result).toBeNull();
    const msgs = sent(ws);
    expect(msgs.length).toBe(1);
    expect(msgs[0]!.type).toBe(SESSION_ERROR);
    expect(msgs[0]!.code).toBe(NOT_AUTHENTICATED);
  });

  it("returns PlayerContext for an authenticated session", () => {
    const sessions = new Sessions();
    const auth = new Auth(sessions);
    const ws = makeSocket("p1");
    sessions.open(ws, "player-1");

    const result = auth.resolve(ws);

    expect(result).not.toBeNull();
    expect(result!.playerId).toBe("player-1");
    expect(result!.roomId).toBeNull();
    expect(result!.color).toBeNull();
  });

  it("includes roomId and color when session is in a game", () => {
    const sessions = new Sessions();
    const auth = new Auth(sessions);
    const ws = makeSocket("p1");
    sessions.open(ws, "player-1");
    sessions.bind(ws, { roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

    const result = auth.resolve(ws);

    expect(result).not.toBeNull();
    expect(result!.playerId).toBe("player-1");
    expect(result!.roomId).toBe("room-1");
    expect(result!.color).toBe(WHITE);
  });
});
