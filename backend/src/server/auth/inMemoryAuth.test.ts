import { describe, expect, it } from "bun:test";

import { InMemoryAuthToken } from "./in-memory-auth-token";

describe("InMemoryAuthToken", () => {
  it("issues a token and finds it by token", async () => {
    const tokens = new InMemoryAuthToken();

    const issued = await tokens.issue("player-1");
    const found = await tokens.findByToken(issued.token);

    expect(found).toEqual(issued);
  });

  it("returns null for an unknown token", async () => {
    const tokens = new InMemoryAuthToken();

    expect(await tokens.findByToken("does-not-exist")).toBeNull();
  });

  it("revokes a token", async () => {
    const tokens = new InMemoryAuthToken();

    const issued = await tokens.issue("player-1");

    await tokens.revoke(issued.token);

    expect(await tokens.findByToken(issued.token)).toBeNull();
  });

  it("sets expiresAt correctly", async () => {
    const tokens = new InMemoryAuthToken();

    const issued = await tokens.issue("player-1");

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    expect(issued.expiresAt).toBe(issued.issuedAt + THIRTY_DAYS);
  });

  it("issues unique tokens", async () => {
    const tokens = new InMemoryAuthToken();

    const all = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const issued = await tokens.issue(`player-${i}`);
      all.add(issued.token);
    }

    expect(all.size).toBe(1000);
  });
});
