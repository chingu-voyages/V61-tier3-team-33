import { describe, expect, it, mock } from "bun:test";

import type { Publisher } from "../../events/hub";
import { CONNECTION_OPENED } from "../../protocol/events";
import type { SessionStore } from "../../store/session/session-store";
import { type WebSocket, WS_OPEN } from "../../types";
import type { Grace } from "../../util/grace";
import { IdentifyCommand } from "./identify";

describe("IdentifyCommand", () => {
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: mock(() => {}),
    };
  }

  function makeSession(overrides = {}) {
    return {
      token: "token-1",
      playerId: "player-1",
      ws: makeSocket(),
      roomId: null,
      color: null,
      mode: null,
      connectedAt: Date.now(),
      disconnectedAt: null,
      ...overrides,
    };
  }

  function makeStore(session: ReturnType<typeof makeSession>): SessionStore {
    return {
      resumeOrOpen: mock(() => session),
      bySocket: mock(() => null),
      byToken: mock(() => null),
      byPlayerId: mock(() => null),
      open: mock(() => session),
      resume: mock(() => null),
      drop: mock(() => {}),
      bind: mock(() => {}),
      clearSession: mock(() => {}),
      clearByPlayerId: mock(() => {}),
      reattachSocket: mock(() => null),
      prune: mock(() => {}),
      startPruning: mock(() => {}),
      stopPruning: mock(() => {}),
    };
  }

  function makeGrace() {
    return {
      cancel: mock(() => true),
      start: mock(() => 0),
      getDeadline: mock(() => null),
      clear: mock(() => {}),
    } as unknown as Grace;
  }

  it("resumes session and returns the player context", () => {
    const ws = makeSocket();
    const session = makeSession();
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new IdentifyCommand(sessions, publisher, grace);
    const result = cmd.run(ws, "token-1");

    expect(sessions.resumeOrOpen).toHaveBeenCalledWith(ws, "token-1");
    expect(result).toEqual({
      playerId: "player-1",
      roomId: null,
      color: null,
      mode: null,
    });
  });

  it("cancels any existing grace timer for the player", () => {
    const ws = makeSocket();
    const session = makeSession();
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new IdentifyCommand(sessions, publisher, grace);
    cmd.run(ws);

    expect(grace.cancel).toHaveBeenCalledWith("player-1");
  });

  it("emits connectionOpened signal", () => {
    const ws = makeSocket();
    const session = makeSession({ ws });
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new IdentifyCommand(sessions, publisher, grace);
    cmd.run(ws);

    expect(publisher.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: CONNECTION_OPENED, playerId: "player-1" }),
    );
  });

  it("opens a fresh session when no token is given", () => {
    const ws = makeSocket();
    const freshSession = makeSession({ token: "fresh-token", playerId: "fresh-player" });
    const sessions = makeStore(freshSession);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new IdentifyCommand(sessions, publisher, grace);
    const result = cmd.run(ws);

    expect(sessions.resumeOrOpen).toHaveBeenCalledWith(ws, undefined);
    expect(result.playerId).toBe("fresh-player");
  });

  it("sends handshake reply", () => {
    const send = mock<(data: string) => void>(() => {});
    const ws = { ...makeSocket(), send };
    const session = makeSession({ token: "tok-1", ws });
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new IdentifyCommand(sessions, publisher, grace);
    cmd.run(ws);

    expect(send).toHaveBeenCalledWith(expect.any(String));
    const sent = JSON.parse(send.mock.calls[0]![0]);
    expect(sent.type).toBe("session:handshake");
    expect(sent.playerId).toBe("player-1");
    expect(sent.token).toBe("tok-1");
  });
});
