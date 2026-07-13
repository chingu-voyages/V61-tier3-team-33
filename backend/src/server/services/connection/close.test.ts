import { describe, expect, it, mock } from "bun:test";

import type { Publisher } from "../../events/hub";
import type { SessionStore } from "../../store/session/session-store";
import { BLACK, type PieceColor, type WebSocket, WHITE, WS_OPEN } from "../../types";
import type { Grace } from "../../util/grace";
import { CloseCommand } from "./close";

describe("CloseCommand", () => {
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: mock(() => {}),
    };
  }

  function makeSession(
    overrides: Partial<{
      playerId: string;
      roomId: string | null;
      color: PieceColor | null;
      ws: WebSocket;
    }> = {},
  ) {
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

  function makeStore(session?: ReturnType<typeof makeSession>): SessionStore {
    return {
      bySocket: mock(() => session ?? null),
      byToken: mock(() => null),
      byPlayerId: mock(() => null),
      open: mock(() => session!),
      resume: mock(() => null),
      resumeOrOpen: mock(() => session!),
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

  it("drops the session when the socket is found", () => {
    const ws = makeSocket();
    const session = makeSession();
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new CloseCommand(sessions, publisher, grace, 30_000);
    cmd.run(ws);

    expect(sessions.drop).toHaveBeenCalledWith(ws);
  });

  it("emits connectionClosed signal", () => {
    const ws = makeSocket();
    const session = makeSession({ ws });
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new CloseCommand(sessions, publisher, grace, 30_000);
    cmd.run(ws);

    expect(publisher.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "connection:closed", playerId: "player-1" }),
    );
  });

  it("starts a grace period when the player was in a room", () => {
    const ws = makeSocket();
    const session = makeSession({ roomId: "room-1", color: WHITE });
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new CloseCommand(sessions, publisher, grace, 30_000);
    cmd.run(ws);

    expect(grace.start).toHaveBeenCalledWith("player-1", WHITE, 30_000, expect.any(Function));
  });

  it("fires graceExpired when the grace callback is invoked", () => {
    const ws = makeSocket();
    const session = makeSession({ roomId: "room-1", color: BLACK });
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    let onExpire: () => void = () => {};
    const grace = {
      cancel: mock(() => true),
      start: mock((_key: string, _color: PieceColor, _timeoutMs: number, cb: () => void) => {
        onExpire = cb;
        return 0;
      }),
      getDeadline: mock(() => null),
      clear: mock(() => {}),
    } as unknown as Grace;

    const cmd = new CloseCommand(sessions, publisher, grace, 30_000);
    cmd.run(ws);

    onExpire();

    expect(publisher.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "grace:expired", roomId: "room-1", color: BLACK }),
    );
  });

  it("does not start grace when the player was not in a room", () => {
    const ws = makeSocket();
    const session = makeSession({ roomId: null, color: null });
    const sessions = makeStore(session);
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new CloseCommand(sessions, publisher, grace, 30_000);
    cmd.run(ws);

    expect(grace.start).not.toHaveBeenCalled();
  });

  it("is a no-op when the socket has no session", () => {
    const ws = makeSocket();
    const sessions = makeStore();
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    const grace = makeGrace();

    const cmd = new CloseCommand(sessions, publisher, grace, 30_000);
    cmd.run(ws);

    expect(sessions.drop).not.toHaveBeenCalled();
    expect(publisher.emit).not.toHaveBeenCalled();
    expect(grace.start).not.toHaveBeenCalled();
  });
});
