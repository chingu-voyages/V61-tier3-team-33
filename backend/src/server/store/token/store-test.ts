import { describe, expect, it } from "bun:test";

import { TOKEN_NOT_FOUND, TOKEN_PLAYER_MISSING } from "../../types/result";
import { PASSWORD, Player } from "../player/player";
import type { PlayerStore } from "../player/player-store";
import type { TokenStore } from "./token-store";
import { TOKEN_TTL_MS } from "./token-store";

function getOk<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

export function testTokenStore(createStore: () => { tokens: TokenStore; players: PlayerStore }, label: string): void {
  describe(label, () => {
    describe("issue + findByToken round-trip", () => {
      it("returns the issued token by token value", async () => {
        const { tokens, players } = createStore();
        const player = Player.create("alice", PASSWORD);
        await players.save(player);

        const issued = getOk(await tokens.issue(player.pid));
        const found = getOk(await tokens.findByToken(issued.token));

        expect(found.token).toBe(issued.token);
        expect(found.playerId).toBe(player.pid);
      });

      it("round-trips every field", async () => {
        const { tokens, players } = createStore();
        const player = Player.create("bob", PASSWORD);
        await players.save(player);

        const issued = getOk(await tokens.issue(player.pid));
        const found = getOk(await tokens.findByToken(issued.token));

        expect(found.token).toBe(issued.token);
        expect(found.playerId).toBe(issued.playerId);
        expect(found.issuedAt).toBe(issued.issuedAt);
        expect(found.expiresAt).toBe(issued.expiresAt);
      });
    });

    describe("expiry", () => {
      it("sets expiresAt = issuedAt + TTL constant", async () => {
        const { tokens, players } = createStore();
        const player = Player.create("charlie", PASSWORD);
        await players.save(player);

        const issued = getOk(await tokens.issue(player.pid));
        expect(issued.expiresAt - issued.issuedAt).toBe(TOKEN_TTL_MS);
      });

      it("findByToken returns null for an unknown token", async () => {
        const { tokens } = createStore();

        const result = await tokens.findByToken("no-such-token");
        expect(result).toMatchObject({ error: TOKEN_NOT_FOUND });
      });
    });

    describe("revoke", () => {
      it("revoked token returns null", async () => {
        const { tokens, players } = createStore();
        const player = Player.create("dave", PASSWORD);
        await players.save(player);

        const issued = getOk(await tokens.issue(player.pid));
        await tokens.revoke(issued.token);

        const result = await tokens.findByToken(issued.token);
        expect(result).toMatchObject({ error: TOKEN_NOT_FOUND });
      });

      it("revoke on an unknown token is a no-op", async () => {
        const { tokens } = createStore();

        const result = await tokens.revoke("no-such-token");
        expect(result.ok).toBe(true);
      });
    });

    describe("multiple tokens per player", () => {
      it("two issues produce distinct tokens, both independently findable and revocable", async () => {
        const { tokens, players } = createStore();
        const player = Player.create("eve", PASSWORD);
        await players.save(player);

        const t1 = getOk(await tokens.issue(player.pid));
        const t2 = getOk(await tokens.issue(player.pid));

        expect(t1.token).not.toBe(t2.token);

        expect(getOk(await tokens.findByToken(t1.token)).token).toBe(t1.token);
        expect(getOk(await tokens.findByToken(t2.token)).token).toBe(t2.token);

        await tokens.revoke(t1.token);
        expect(await tokens.findByToken(t1.token)).toMatchObject({ error: TOKEN_NOT_FOUND });
        expect(getOk(await tokens.findByToken(t2.token)).token).toBe(t2.token);
      });
    });

    describe("player existence check on issue", () => {
      it("rejects with TOKEN_PLAYER_MISSING when player does not exist", async () => {
        const { tokens } = createStore();

        const result = await tokens.issue("p_nonexistent");
        expect(result).toMatchObject({ error: TOKEN_PLAYER_MISSING });
      });
    });
  });
}
