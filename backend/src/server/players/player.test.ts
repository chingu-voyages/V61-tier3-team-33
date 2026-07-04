import { expect, test } from "bun:test";
import { createGuestPlayer } from "./player";
import { createPlayer } from "./player";
import { InMemoryPlayers } from "./inMemortPlayers.class";

test("creates a guest player", () => {
  const player = createGuestPlayer();

  expect(player.id).toMatch(/^p_[a-f0-9]{8}$/);
  expect(player.username).toMatch(/^Guest-[a-f0-9]{4}$/);

  expect(player.role).toBe("guest");
  expect(player.authProvider).toBe("guest");

  expect(player.results).toEqual([]);
});

test("creates a registered player", () => {
    const player = createPlayer("kartik", "password");
  
    expect(player.id).toMatch(/^p_[a-f0-9]{8}$/);
  
    expect(player.username).toBe("kartik");
  
    expect(player.role).toBe("member");
    expect(player.authProvider).toBe("password");
  
    expect(player.results).toEqual([]);
  });
  test("createdAt is current time", () => {
    const before = Date.now();
  
    const player = createGuestPlayer();
  
    const after = Date.now();
  
    expect(player.createdAt).toBeGreaterThanOrEqual(before);
    expect(player.createdAt).toBeLessThanOrEqual(after);
  });
  test("creates unique ids", () => {
    const ids = new Set();
  
    for (let i = 0; i < 1000; i++) {
      ids.add(createGuestPlayer().id);
    }
  
    expect(ids.size).toBe(1000);
  });

  


test("save then findById", async () => {
  const repo = new InMemoryPlayers();

  const player = createGuestPlayer();

  await repo.save(player);

  expect(await repo.findById(player.id)).toEqual(player);
});
test("save then findByUsername", async () => {
    const repo = new InMemoryPlayers();
  
    const player = createGuestPlayer();
  
    await repo.save(player);
  
    expect(await repo.findByUsername(player.username)).toEqual(player);
  });
  test("unknown player returns null", async () => {
    const repo = new InMemoryPlayers();
  
    expect(await repo.findById("abc")).toBeNull();
  
    expect(await repo.findByUsername("john")).toBeNull();
  });

  test("updates username index", async () => {
    const repo = new InMemoryPlayers();
  
    const player = createGuestPlayer();
  
    await repo.save(player);
  
    player.username = "kartik";
  
    await repo.save(player);
  
    expect(await repo.findByUsername("kartik")).toEqual(player);
  
    expect(await repo.findByUsername("Guest-xxxx")).toBeNull();
  });