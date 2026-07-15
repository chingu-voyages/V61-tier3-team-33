import { describe, expect, it, mock } from "bun:test";

import type { Publisher } from "../../events/hub";
import type { SessionStore } from "../../store/session/session-store";
import { type WebSocket, WS_OPEN } from "../../types";
import { ConnectionRegistry } from "./registry";

describe("ConnectionRegistry", () => {
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: mock(() => {}),
    };
  }

  function makeSession() {
    return {
      token: "t",
      playerId: "p",
      ws: makeSocket(),
      roomId: null,
      color: null,
      mode: null,
      connectedAt: 0,
      disconnectedAt: null,
    };
  }

  function makeDeps() {
    const session = makeSession();
    const sessions = {
      bySocket: mock(() => null),
      byToken: mock(() => null),
      byPlayerId: mock(() => null),
      open: mock(() => session),
      resume: mock(() => null),
      resumeOrOpen: mock(() => session),
      drop: mock(() => {}),
      bind: mock(() => {}),
      clearSession: mock(() => {}),
      clearByPlayerId: mock(() => {}),
      reattachSocket: mock(() => null),
      prune: mock(() => {}),
      startPruning: mock(() => {}),
      stopPruning: mock(() => {}),
    } satisfies SessionStore;
    const publisher = { emit: mock(() => {}) } satisfies Publisher;
    return { sessions, publisher };
  }

  it("creates identify, close, and pong commands", () => {
    const { sessions, publisher } = makeDeps();

    const registry = new ConnectionRegistry(sessions, publisher);

    expect(registry.identify).toBeDefined();
    expect(registry.close).toBeDefined();
    expect(registry.pong).toBeDefined();
  });
});
