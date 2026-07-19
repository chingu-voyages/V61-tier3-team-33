import { describe, expect, it } from "bun:test";

import { PLAYER_NOT_FOUND, USERNAME_TAKEN } from "../../types/result";
import { GOOGLE, PASSWORD, Player } from "./player";
import type { PlayerStore } from "./player-store";

function saveOk(store: PlayerStore, player: Player) {
  return store.save(player).then((r) => {
    expect(r.ok).toBe(true);
  });
}

function getOk<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

export function testPlayerStore(makeStore: () => PlayerStore, label: string): void {
  describe(label, () => {
    describe("save + findById round-trip", () => {
      it("returns the saved player for a guest", async () => {
        const store = makeStore();
        const player = Player.createGuest();

        await saveOk(store, player);

        const found = await store.findById(player.pid);
        expect(found).toMatchObject({ ok: true, value: player });
      });

      it("returns the saved player for a registered player", async () => {
        const store = makeStore();
        const player = Player.create("alice", PASSWORD);

        await saveOk(store, player);

        const found = await store.findById(player.pid);
        expect(found).toMatchObject({ ok: true, value: player });
      });

      it("round-trips every field", async () => {
        const store = makeStore();
        const player = Player.create("bob", GOOGLE);

        await saveOk(store, player);

        const found = getOk(await store.findById(player.pid));
        expect(found.pid).toBe(player.pid);
        expect(found.username).toBe(player.username);
        expect(found.role).toBe(player.role);
        expect(found.provider).toBe(player.provider);
        expect(found.createdAt).toBe(player.createdAt);
      });
    });

    describe("findByUsername", () => {
      it("finds a saved non-guest player case-insensitively", async () => {
        const store = makeStore();
        const player = Player.create("Bob", PASSWORD);

        await saveOk(store, player);

        const found = getOk(await store.findByUsername("bob"));
        expect(found.pid).toBe(player.pid);
        expect(found.username).toBe("Bob");
      });

      it("finds a guest player by exact username", async () => {
        const store = makeStore();
        const player = Player.createGuest();

        await saveOk(store, player);

        const found = getOk(await store.findByUsername(player.username));
        expect(found.pid).toBe(player.pid);
      });

      it("returns err for an unknown username", async () => {
        const store = makeStore();

        const found = await store.findByUsername("nobody");
        expect(found.ok).toBe(false);
      });
    });

    describe("guest username collision", () => {
      it("allows two guests with the same username", async () => {
        const store = makeStore();
        const guest1 = Player.createGuest();
        const guest2 = Player.createGuest();
        guest2.username = guest1.username;
        (guest2 as { pid: string }).pid = "p_guest2id";

        await saveOk(store, guest1);
        await saveOk(store, guest2);

        const found1 = await store.findById(guest1.pid);
        const found2 = await store.findById(guest2.pid);
        expect(found1.ok).toBe(true);
        expect(found2.ok).toBe(true);
      });

      it("findByUsername returns one of the duplicate-guest rows", async () => {
        const store = makeStore();
        const guest1 = Player.createGuest();
        const guest2 = Player.createGuest();
        const dupUsername = "SharedGuest";
        guest1.username = dupUsername;
        guest2.username = dupUsername;
        (guest2 as { pid: string }).pid = "p_guest2id";

        await saveOk(store, guest1);
        await saveOk(store, guest2);

        const found = getOk(await store.findByUsername(dupUsername));
        expect(found.username).toBe(dupUsername);
      });
    });

    describe("non-guest username uniqueness", () => {
      it("rejects a second non-guest save with the same username", async () => {
        const store = makeStore();
        const player1 = Player.create("alice", PASSWORD);
        const player2 = Player.create("alice", GOOGLE);

        await store.save(player1);

        expect(player1.pid).not.toBe(player2.pid);
        const result = await store.save(player2);
        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ error: USERNAME_TAKEN });
      });

      it("rejects a second non-guest save with a case-different collision", async () => {
        const store = makeStore();
        const player1 = Player.create("Alice", PASSWORD);
        const player2 = Player.create("alice", GOOGLE);

        await store.save(player1);

        const result = await store.save(player2);
        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ error: USERNAME_TAKEN });
      });

      it("leaves the first player unchanged after a rejected save", async () => {
        const store = makeStore();
        const player1 = Player.create("alice", PASSWORD);
        const player2 = Player.create("alice", GOOGLE);

        await saveOk(store, player1);

        await store.save(player2);

        const found = getOk(await store.findById(player1.pid));
        expect(found.username).toBe("alice");
      });

      it("rejects re-save when non-guest changes username to an already-taken name", async () => {
        const store = makeStore();
        const player1 = Player.create("alice", PASSWORD);
        const player2 = Player.create("bob", PASSWORD);

        await saveOk(store, player1);
        await saveOk(store, player2);

        player2.username = "alice";
        const result = await store.save(player2);
        expect(result).toMatchObject({ error: USERNAME_TAKEN });
      });

      it("leaves indexes intact after a rejected username-change save", async () => {
        const store = makeStore();
        const player1 = Player.create("alice", PASSWORD);
        const player2 = Player.create("bob", PASSWORD);

        await saveOk(store, player1);
        await saveOk(store, player2);

        player2.username = "alice";
        await store.save(player2);

        const found = await store.findByUsername("bob");
        expect(found.ok).toBe(true);
        const taken = getOk(await store.findByUsername("alice"));
        expect(taken.pid).toBe(player1.pid);
      });

      it("allows a guest to change username", async () => {
        const store = makeStore();
        const guest = Player.createGuest();

        await saveOk(store, guest);

        guest.username = "NewGuestName";
        await saveOk(store, guest);

        const found = getOk(await store.findById(guest.pid));
        expect(found.username).toBe("NewGuestName");
      });

      it("allows a non-guest and a guest to share a username", async () => {
        const store = makeStore();
        const member = Player.create("guest", PASSWORD);
        const guest = Player.createGuest();
        guest.username = "guest";

        await saveOk(store, member);
        await saveOk(store, guest);

        const found = await store.findByUsername("guest");
        expect(found.ok).toBe(true);
      });
    });

    describe("nonexistent lookups return err", () => {
      it("findById returns PLAYER_NOT_FOUND for an unknown id", async () => {
        const store = makeStore();

        const result = await store.findById("p_nonexistent");
        expect(result).toMatchObject({ error: PLAYER_NOT_FOUND });
      });

      it("findByUsername returns PLAYER_NOT_FOUND for an unknown username", async () => {
        const store = makeStore();

        const result = await store.findByUsername("nobody");
        expect(result).toMatchObject({ error: PLAYER_NOT_FOUND });
      });
    });

    describe("upsert semantics", () => {
      it("re-save with changed username updates the stored value", async () => {
        const store = makeStore();
        const player = Player.create("oldname", PASSWORD);

        await saveOk(store, player);

        player.username = "newname";
        await saveOk(store, player);

        const found = getOk(await store.findById(player.pid));
        expect(found.username).toBe("newname");
      });

      it("findByUsername finds the player under the new username after re-save", async () => {
        const store = makeStore();
        const player = Player.create("oldname", PASSWORD);

        await saveOk(store, player);

        player.username = "newname";
        await saveOk(store, player);

        const byNew = await store.findByUsername("newname");
        expect(byNew.ok).toBe(true);
        const byOld = await store.findByUsername("oldname");
        expect(byOld.ok).toBe(false);
      });
    });
  });
}
