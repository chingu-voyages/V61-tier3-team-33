import { describe, expect, it } from "bun:test";

import { OAUTH_NOT_FOUND, OAUTH_PLAYER_ID_TAKEN, OAUTH_PLAYER_MISSING, OAUTH_SUBJECT_TAKEN } from "../../types/result";
import { PASSWORD, Player } from "../player/player";
import type { PlayerStore } from "../player/player-store";
import type { OAuthIdentity } from "./oauth-identity";
import type { OAuthStore } from "./oauth-store";

function saveOk(store: OAuthStore, identity: OAuthIdentity) {
  return store.save(identity).then((r) => {
    expect(r.ok).toBe(true);
  });
}

function getOk<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

function makeIdentity(playerId: string, sub?: string, email?: string): OAuthIdentity {
  return {
    playerId,
    provider: "google",
    providerSub: sub ?? `${playerId}-sub`,
    email: email ?? null,
    createdAt: Date.now(),
  };
}

export function testOAuthStore(createStore: () => { oauth: OAuthStore; players: PlayerStore }, label: string): void {
  describe(label, () => {
    describe("save + findByPlayerId round-trip", () => {
      it("returns the saved identity by playerId", async () => {
        const { oauth, players } = createStore();
        const player = Player.create("alice", PASSWORD);
        await players.save(player);
        const identity = makeIdentity(player.pid);

        await saveOk(oauth, identity);

        const found = await oauth.findByPlayerId(player.pid);
        expect(found).toMatchObject({ ok: true, value: identity });
      });

      it("round-trips every field", async () => {
        const { oauth, players } = createStore();
        const player = Player.create("bob", PASSWORD);
        await players.save(player);
        const identity = makeIdentity(player.pid, "bob-sub", "bob@gmail.com");

        await saveOk(oauth, identity);

        const found = getOk(await oauth.findByPlayerId(player.pid));
        expect(found.playerId).toBe(identity.playerId);
        expect(found.provider).toBe("google");
        expect(found.providerSub).toBe(identity.providerSub);
        expect(found.email).toBe(identity.email);
        expect(found.createdAt).toBe(identity.createdAt);
      });
    });

    describe("findBySubject", () => {
      it("finds by provider and sub", async () => {
        const { oauth, players } = createStore();
        const player = Player.create("charlie", PASSWORD);
        await players.save(player);
        const identity = makeIdentity(player.pid, "charlie-sub");

        await saveOk(oauth, identity);

        const found = getOk(await oauth.findBySubject("google", "charlie-sub"));
        expect(found.playerId).toBe(player.pid);
      });

      it("returns err for an unknown subject", async () => {
        const { oauth } = createStore();

        const result = await oauth.findBySubject("google", "nobody");
        expect(result).toMatchObject({ error: OAUTH_NOT_FOUND });
      });
    });

    describe("findByPlayerId returns err for unknown playerId", () => {
      it("returns OAUTH_NOT_FOUND", async () => {
        const { oauth } = createStore();

        const result = await oauth.findByPlayerId("p_nonexistent");
        expect(result).toMatchObject({ error: OAUTH_NOT_FOUND });
      });
    });

    describe("duplicate playerId on save", () => {
      it("rejects with OAUTH_PLAYER_ID_TAKEN", async () => {
        const { oauth, players } = createStore();
        const player = Player.create("dave", PASSWORD);
        await players.save(player);
        const identity = makeIdentity(player.pid);

        await saveOk(oauth, identity);

        const result = await oauth.save(makeIdentity(player.pid, "other-sub"));
        expect(result).toMatchObject({ error: OAUTH_PLAYER_ID_TAKEN });
      });

      it("leaves the original identity unchanged after rejection", async () => {
        const { oauth, players } = createStore();
        const player = Player.create("eve", PASSWORD);
        await players.save(player);
        const identity = makeIdentity(player.pid, "eve-sub");

        await saveOk(oauth, identity);

        await oauth.save(makeIdentity(player.pid, "other-sub"));

        const found = getOk(await oauth.findByPlayerId(player.pid));
        expect(found.providerSub).toBe("eve-sub");
      });
    });

    describe("duplicate (provider, sub) on save", () => {
      it("rejects with OAUTH_SUBJECT_TAKEN", async () => {
        const { oauth, players } = createStore();
        const player1 = Player.create("frank", PASSWORD);
        const player2 = Player.create("grace", PASSWORD);
        await players.save(player1);
        await players.save(player2);

        await saveOk(oauth, makeIdentity(player1.pid, "shared-sub"));

        const result = await oauth.save(makeIdentity(player2.pid, "shared-sub"));
        expect(result).toMatchObject({ error: OAUTH_SUBJECT_TAKEN });
      });
    });

    describe("player existence check on save", () => {
      it("rejects with PLAYER_MISSING when player does not exist", async () => {
        const { oauth } = createStore();

        const result = await oauth.save(makeIdentity("p_nonexistent"));
        expect(result).toMatchObject({ error: OAUTH_PLAYER_MISSING });
      });
    });
  });
}
