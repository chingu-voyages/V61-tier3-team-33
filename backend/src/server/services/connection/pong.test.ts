import { describe, expect, it, mock } from "bun:test";

import { type WebSocket, WS_OPEN } from "../../types";
import { PongCommand } from "./pong";

describe("PongCommand", () => {
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: mock(() => {}),
    };
  }

  it("does not throw when called", () => {
    const ws = makeSocket();
    const cmd = new PongCommand();

    expect(() => cmd.run(ws)).not.toThrow();
  });

  it("accepts any WebSocket", () => {
    const ws1 = makeSocket();
    const ws2 = makeSocket();
    const cmd = new PongCommand();

    cmd.run(ws1);
    cmd.run(ws2);

    // no state — just logging
    expect(true).toBe(true);
  });
});
