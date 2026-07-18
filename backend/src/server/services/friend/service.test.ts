import { beforeEach, describe, expect, it } from "bun:test";

import type { FriendStore } from "../../store/friend/friend-store";
import { MemoryFriends } from "../../store/friend/memory";
import { MemoryPlayers } from "../../store/player/memory";
import { PASSWORD, Player } from "../../store/player/player";
import { ALREADY_EXISTS, CANNOT_FRIEND_SELF, FRIEND_NOT_FOUND } from "../../types/result";
import { FriendService } from "./service";

let friends: FriendStore;
let players: MemoryPlayers;
let service: FriendService;

beforeEach(() => {
  friends = new MemoryFriends();
  players = new MemoryPlayers();
  service = new FriendService(friends, players);
});

async function savePlayer(pid: string, username: string): Promise<void> {
  const p = Player.create(username, PASSWORD);
  // Override the generated pid for predictable test ids
  const player = { ...p, pid };
  await players.save(player);
}

describe("FriendService", () => {
  describe("sendRequest", () => {
    it("sends a friend request between two valid players", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");

      const result = await service.sendRequest("p1", "p2");
      expect(result.ok).toBe(true);
    });

    it("rejects self-friend request", async () => {
      await savePlayer("p1", "alice");

      const result = await service.sendRequest("p1", "p1");
      expect(result).toMatchObject({ error: CANNOT_FRIEND_SELF });
    });

    it("rejects when sender does not exist", async () => {
      await savePlayer("p2", "bob");

      const result = await service.sendRequest("p_nonexistent", "p2");
      expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
    });

    it("rejects when receiver does not exist", async () => {
      await savePlayer("p1", "alice");

      const result = await service.sendRequest("p1", "p_nonexistent");
      expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
    });

    it("rejects duplicate request", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");

      const result = await service.sendRequest("p1", "p2");
      expect(result).toMatchObject({ error: ALREADY_EXISTS });
    });
  });

  describe("acceptRequest", () => {
    it("accepts a pending request", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");

      const result = await service.acceptRequest("p2", "p1");
      expect(result.ok).toBe(true);

      const list = await service.listFriends("p1");
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value.length).toBe(1);
    });

    it("rejects when the requester tries to accept their own request", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");

      const result = await service.acceptRequest("p1", "p2");
      expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
    });

    it("rejects non-existent request", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");

      const result = await service.acceptRequest("p2", "p1");
      expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
    });

    it("rejects self-accept", async () => {
      await savePlayer("p1", "alice");
      const result = await service.acceptRequest("p1", "p1");
      expect(result).toMatchObject({ error: CANNOT_FRIEND_SELF });
    });

    it("is idempotent on already-accepted request", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");
      await service.acceptRequest("p2", "p1");

      const result = await service.acceptRequest("p2", "p1");
      expect(result.ok).toBe(true);
    });
  });

  describe("block", () => {
    it("blocks a player", async () => {
      const result = await service.block("p1", "p2");
      expect(result.ok).toBe(true);
    });
  });

  describe("remove", () => {
    it("removes a friendship", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");

      const result = await service.remove("p1", "p2");
      expect(result.ok).toBe(true);
    });

    it("rejects non-existent friendship", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");

      const result = await service.remove("p1", "p2");
      expect(result).toMatchObject({ error: FRIEND_NOT_FOUND });
    });
  });

  describe("listFriends", () => {
    it("returns empty for a player with no friends", async () => {
      const result = await service.listFriends("p_alone");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual([]);
    });

    it("returns accepted friends for a player", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");
      await service.acceptRequest("p2", "p1");

      const result = await service.listFriends("p1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
    });
  });

  describe("pendingRequests", () => {
    it("returns pending requests for a player", async () => {
      await savePlayer("p1", "alice");
      await savePlayer("p2", "bob");
      await service.sendRequest("p1", "p2");

      const result = await service.pendingRequests("p2");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
    });

    it("returns empty for player with no pending requests", async () => {
      await savePlayer("p1", "alice");
      const result = await service.pendingRequests("p1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual([]);
    });
  });
});
