import { describe, expect, it } from "bun:test";

import { CREDENTIAL_NOT_FOUND, EMAIL_TAKEN, PLAYER_ID_TAKEN, PLAYER_MISSING } from "../../types/result";
import { PASSWORD, Player } from "../player/player";
import type { PlayerStore } from "../player/player-store";
import type { PasswordCredential } from "./credential";
import type { CredentialStore } from "./credential-store";

function saveOk(store: CredentialStore, cred: PasswordCredential) {
  return store.save(cred).then((r) => {
    expect(r.ok).toBe(true);
  });
}

function getOk<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

function makeCred(playerId: string, email?: string): PasswordCredential {
  return {
    playerId,
    email: email ?? `${playerId}@test.com`,
    passwordHash: "hashed_password",
    createdAt: Date.now(),
  };
}

export function testCredentialStore(
  createStore: () => { creds: CredentialStore; players: PlayerStore },
  label: string,
): void {
  describe(label, () => {
    describe("save + findByPlayerId round-trip", () => {
      it("returns the saved credential by playerId", async () => {
        const { creds, players } = createStore();
        const player = Player.create("alice", PASSWORD);
        await players.save(player);
        const cred = makeCred(player.pid);

        await saveOk(creds, cred);

        const found = await creds.findByPlayerId(player.pid);
        expect(found).toMatchObject({ ok: true, value: cred });
      });

      it("round-trips every field", async () => {
        const { creds, players } = createStore();
        const player = Player.create("bob", PASSWORD);
        await players.save(player);
        const cred = makeCred(player.pid, "bob@test.com");

        await saveOk(creds, cred);

        const found = getOk(await creds.findByPlayerId(player.pid));
        expect(found.playerId).toBe(cred.playerId);
        expect(found.email).toBe(cred.email.toLowerCase());
        expect(found.passwordHash).toBe(cred.passwordHash);
        expect(found.createdAt).toBe(cred.createdAt);
      });
    });

    describe("findByEmail", () => {
      it("finds by email case-insensitively", async () => {
        const { creds, players } = createStore();
        const player = Player.create("charlie", PASSWORD);
        await players.save(player);
        const cred = makeCred(player.pid, "Charlie@Test.com");

        await saveOk(creds, cred);

        const found = getOk(await creds.findByEmail("charlie@test.com"));
        expect(found.playerId).toBe(player.pid);
      });

      it("returns err for an unknown email", async () => {
        const { creds } = createStore();

        const result = await creds.findByEmail("nobody@test.com");
        expect(result).toMatchObject({ error: CREDENTIAL_NOT_FOUND });
      });
    });

    describe("findByPlayerId returns err for unknown playerId", () => {
      it("returns CREDENTIAL_NOT_FOUND", async () => {
        const { creds } = createStore();

        const result = await creds.findByPlayerId("p_nonexistent");
        expect(result).toMatchObject({ error: CREDENTIAL_NOT_FOUND });
      });
    });

    describe("duplicate playerId on save", () => {
      it("rejects with PLAYER_ID_TAKEN", async () => {
        const { creds, players } = createStore();
        const player = Player.create("dave", PASSWORD);
        await players.save(player);
        const cred = makeCred(player.pid);

        await saveOk(creds, cred);

        const result = await creds.save(makeCred(player.pid, "other@test.com"));
        expect(result).toMatchObject({ error: PLAYER_ID_TAKEN });
      });

      it("leaves the original credential unchanged after rejection", async () => {
        const { creds, players } = createStore();
        const player = Player.create("eve", PASSWORD);
        await players.save(player);
        const cred = makeCred(player.pid, "eve@test.com");

        await saveOk(creds, cred);

        await creds.save(makeCred(player.pid, "other@test.com"));

        const found = getOk(await creds.findByPlayerId(player.pid));
        expect(found.email).toBe("eve@test.com");
      });
    });

    describe("duplicate email on save", () => {
      it("rejects with EMAIL_TAKEN", async () => {
        const { creds, players } = createStore();
        const player1 = Player.create("frank", PASSWORD);
        const player2 = Player.create("grace", PASSWORD);
        await players.save(player1);
        await players.save(player2);

        await saveOk(creds, makeCred(player1.pid, "shared@test.com"));

        const result = await creds.save(makeCred(player2.pid, "shared@test.com"));
        expect(result).toMatchObject({ error: EMAIL_TAKEN });
      });

      it("rejects with EMAIL_TAKEN for case-different duplicate", async () => {
        const { creds, players } = createStore();
        const player1 = Player.create("heidi", PASSWORD);
        const player2 = Player.create("ivan", PASSWORD);
        await players.save(player1);
        await players.save(player2);

        await saveOk(creds, makeCred(player1.pid, "CaseDup@test.com"));

        const result = await creds.save(makeCred(player2.pid, "casedup@test.com"));
        expect(result).toMatchObject({ error: EMAIL_TAKEN });
      });
    });

    describe("player existence check on save", () => {
      it("rejects with PLAYER_MISSING when player does not exist", async () => {
        const { creds } = createStore();

        const result = await creds.save(makeCred("p_nonexistent"));
        expect(result).toMatchObject({ error: PLAYER_MISSING });
      });
    });
  });
}
