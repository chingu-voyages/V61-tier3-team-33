import { describe, expect, it } from "bun:test";

import { Friend } from "../../types/friend";
import { ALREADY_EXISTS, CANNOT_FRIEND_SELF, FRIEND_NOT_FOUND } from "../../types/result";
import type { FriendStore } from "./friend-store";

export function testFriendStore(createStore: () => FriendStore, label: string): void {
  describe(label, () => {
    describe("save + findBetween", () => {
      it("returns the saved friendship", async () => {
        const store = createStore();
        const f = Friend.create("p1", "p2");
        await store.save(f);

        const found = await store.findBetween("p1", "p2");
        expect(found.ok).toBe(true);
        if (!found.ok) return;
        expect(found.value.pidA).toBe(f.pidA);
        expect(found.value.pidB).toBe(f.pidB);
        expect(found.value.status).toBe("pending");
        expect(found.value.requestedBy).toBe("p1");
      });

      it("canonicalises the key ordering", async () => {
        const store = createStore();
        const f = Friend.create("z", "a");
        await store.save(f);

        const found = await store.findBetween("z", "a");
        expect(found.ok).toBe(true);
        if (!found.ok) return;
        expect(found.value.pidA).toBe("a");
        expect(found.value.pidB).toBe("z");
      });
    });

    describe("findBetween error cases", () => {
      it("returns FRIEND_NOT_FOUND for non-existent pair", async () => {
        const store = createStore();
        const result = await store.findBetween("p_nonexistent", "p_missing");
        expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
      });
    });

    describe("save error cases", () => {
      it("returns ALREADY_EXISTS for an existing pair", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));

        const result = await store.save(Friend.create("p1", "p2"));
        expect(result).toMatchObject({ error: ALREADY_EXISTS });
      });

      it("detects duplicates regardless of order", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));

        const result = await store.save(Friend.create("p2", "p1"));
        expect(result).toMatchObject({ error: ALREADY_EXISTS });
      });

      it("returns CANNOT_FRIEND_SELF when saving with same pid", async () => {
        const store = createStore();
        const result = await store.save(Friend.create("p1", "p1"));
        expect(result).toMatchObject({ error: CANNOT_FRIEND_SELF });
      });
    });

    describe("accept", () => {
      it("changes status to accepted", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));

        const acceptResult = await store.accept("p1", "p2");
        expect(acceptResult.ok).toBe(true);

        const found = await store.findBetween("p1", "p2");
        expect(found.ok).toBe(true);
        if (!found.ok) return;
        expect(found.value.status).toBe("accepted");
      });

      it("returns FRIEND_NOT_FOUND for non-existent pair", async () => {
        const store = createStore();
        const result = await store.accept("p1", "p2");
        expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
      });

      it("is idempotent on already-accepted status", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));
        await store.accept("p1", "p2");
        const result = await store.accept("p1", "p2");
        expect(result.ok).toBe(true);
      });

      it("upgrades a blocked record to accepted", async () => {
        const store = createStore();
        await store.block("p1", "p2");
        const result = await store.accept("p1", "p2");
        expect(result.ok).toBe(true);

        const found = await store.findBetween("p1", "p2");
        expect(found.ok).toBe(true);
        if (!found.ok) return;
        expect(found.value.status).toBe("accepted");
      });
    });

    describe("block", () => {
      it("sets status to blocked on existing friendship", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));

        const blockResult = await store.block("p1", "p2");
        expect(blockResult.ok).toBe(true);

        const found = await store.findBetween("p1", "p2");
        expect(found.ok).toBe(true);
        if (!found.ok) return;
        expect(found.value.status).toBe("blocked");
      });

      it("creates a blocked entry if none exists", async () => {
        const store = createStore();
        const result = await store.block("p1", "p2");
        expect(result.ok).toBe(true);

        const found = await store.findBetween("p1", "p2");
        expect(found.ok).toBe(true);
        if (!found.ok) return;
        expect(found.value.status).toBe("blocked");
      });

      it("is idempotent on already-blocked record", async () => {
        const store = createStore();
        await store.block("p1", "p2");
        const result = await store.block("p1", "p2");
        expect(result.ok).toBe(true);
      });
    });

    describe("remove", () => {
      it("removes an existing friendship", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));

        const result = await store.remove("p1", "p2");
        expect(result.ok).toBe(true);

        const found = await store.findBetween("p1", "p2");
        expect(found.ok).toBe(false);
      });

      it("returns FRIEND_NOT_FOUND for non-existent pair", async () => {
        const store = createStore();
        const result = await store.remove("p1", "p2");
        expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
      });
    });

    describe("list", () => {
      it("returns only accepted friendships for a player", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));
        await store.accept("p1", "p2");
        await store.save(Friend.create("p3", "p4"));

        const listResult = await store.list("p1");
        expect(listResult.ok).toBe(true);
        if (!listResult.ok) return;
        const list = listResult.value;
        expect(list[0]!.pidB).toBe("p2");
      });

      it("returns empty for players with no friends", async () => {
        const store = createStore();
        const listResult = await store.list("p_alone");
        expect(listResult.ok).toBe(true);
        if (!listResult.ok) return;
        expect(listResult.value).toEqual([]);
      });

      it("excludes pending and blocked from list", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));
        await store.save(Friend.create("p1", "p3"));
        await store.accept("p1", "p3");
        await store.block("p1", "p4");

        const listResult = await store.list("p1");
        expect(listResult.ok).toBe(true);
        if (!listResult.ok) return;
        expect(listResult.value.length).toBe(1);
      });

      it("finds player on both sides of friendships", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));
        await store.accept("p1", "p2");
        await store.save(Friend.create("p3", "p1"));
        await store.accept("p3", "p1");

        const listResult = await store.list("p1");
        expect(listResult.ok).toBe(true);
        if (!listResult.ok) return;
        expect(listResult.value.length).toBe(2);
      });
    });

    describe("pending", () => {
      it("returns pending requests where pid is pidA or pidB", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));

        const pendingResult = await store.pending("p2");
        expect(pendingResult.ok).toBe(true);
        if (!pendingResult.ok) return;
        const pending = pendingResult.value;
        expect(pending[0]!.requestedBy).toBe("p1");
      });

      it("excludes accepted friendships", async () => {
        const store = createStore();
        await store.save(Friend.create("p1", "p2"));
        await store.accept("p1", "p2");

        const pendingResult = await store.pending("p1");
        expect(pendingResult.ok).toBe(true);
        if (!pendingResult.ok) return;
        expect(pendingResult.value).toEqual([]);
      });

      it("excludes blocked from pending", async () => {
        const store = createStore();
        await store.block("p1", "p2");

        const pendingResult = await store.pending("p1");
        expect(pendingResult.ok).toBe(true);
        if (!pendingResult.ok) return;
        expect(pendingResult.value).toEqual([]);
      });

      it("returns empty for players with no requests", async () => {
        const store = createStore();
        const pendingResult = await store.pending("p_alone");
        expect(pendingResult.ok).toBe(true);
        if (!pendingResult.ok) return;
        expect(pendingResult.value).toEqual([]);
      });
    });
  });
}
