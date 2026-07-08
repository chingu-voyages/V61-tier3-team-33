import {
  describe,
  expect,
  it,
  mock,
  spyOn,
  beforeEach,
  afterEach,
} from "bun:test";
import { Games } from "./games";
import type { Occupant } from "../occupant/occupant";
import type { Publisher, Subscriber } from "../bus/bus";
import {
  WHITE,
  BLACK,
  HUMAN,
  HUMAN_VS_HUMAN,
  HUMAN_VS_AI,
} from "../domain/types";

describe("Games", () => {
  function makeOccupant(playerId: string): Occupant {
    return { kind: HUMAN, playerId, notify: mock(() => {}) };
  }

  function makePublisher() {
    return { emit: mock(() => {}), on: mock(() => () => {}), onAny: mock(() => () => {}) } satisfies Publisher & Subscriber;
  }

  /** Fresh store with short TTLs, so expiry tests don't need huge fake-time jumps. */
  function makeStore(resultTtlMs = 1000, emptyTtlMs = 500) {
    return new Games(makePublisher(), resultTtlMs, emptyTtlMs);
  }

  describe("get", () => {
    it("returns null for an id that was never created", () => {
      const store = makeStore();

      expect(store.get("missing")).toBeNull();
    });

    it("returns the game after it's created", () => {
      const store = makeStore();
      const game = store.create("room-1");

      expect(store.get("room-1")).toBe(game);
    });
  });

  describe("create", () => {
    it("uses the given id and mode", () => {
      const store = makeStore();
      const game = store.create("room-1", HUMAN_VS_AI);

      expect(game.id).toBe("room-1");
      expect(game.mode).toBe(HUMAN_VS_AI);
    });

    it("generates an id when none is given", () => {
      const store = makeStore();
      const game = store.create();

      expect(game.id).toBeTruthy();
      expect(store.get(game.id)).toBe(game);
    });

    it("defaults to HUMAN_VS_HUMAN when no mode is given", () => {
      const store = makeStore();
      const game = store.create("room-1");

      expect(game.mode).toBe(HUMAN_VS_HUMAN);
    });

    it("starts the game WAITING and makes it discoverable via findWaiting", () => {
      const store = makeStore();
      const game = store.create("room-1", HUMAN_VS_HUMAN);

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBe(game);
    });
  });

  describe("findWaiting", () => {
    it("returns null when no game of that mode exists", () => {
      const store = makeStore();

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBeNull();
    });

    it("does not return a game from a different mode", () => {
      const store = makeStore();
      store.create("room-1", HUMAN_VS_AI);

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBeNull();
    });

    it("returns the oldest waiting game first (queue order)", () => {
      const store = makeStore();
      const first = store.create("room-1", HUMAN_VS_HUMAN);
      store.create("room-2", HUMAN_VS_HUMAN);

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBe(first);
    });

    it("stops returning a game once it becomes ACTIVE via join", () => {
      const store = makeStore();
      const game = store.create("room-1", HUMAN_VS_HUMAN);

      game.join(WHITE, makeOccupant("p1"));
      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBe(game); // still waiting, one seat open

      game.join(BLACK, makeOccupant("p2"));
      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBeNull(); // now ACTIVE, removed via onActivated
    });

    it("falls through to the next queued game once the first activates", () => {
      const store = makeStore();
      const first = store.create("room-1", HUMAN_VS_HUMAN);
      const second = store.create("room-2", HUMAN_VS_HUMAN);

      first.join(WHITE, makeOccupant("p1"));
      first.join(BLACK, makeOccupant("p2")); // first activates, drops out of the queue

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBe(second);
    });

    it("self-heals by skipping and discarding stale queue entries", () => {
      const store = makeStore();
      const game = store.create("room-1", HUMAN_VS_HUMAN);

      // Simulate the game having been removed from the map through some
      // path that didn't also clean the queue (defensive-path coverage).
      (store as unknown as { games: Map<string, unknown> }).games.delete(
        "room-1",
      );

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBeNull();
      // The stale id should be gone now too, not just skipped.
      const queue = (
        store as unknown as { queue: Map<string, Set<string>> }
      ).queue.get(`0:default`);
      expect(queue?.has("room-1")).toBe(false);
    });
  });

  describe("commit", () => {
    it("stores the given game under the given id and returns ok", () => {
      const store = makeStore();
      const original = store.create("room-1");
      const replacement = store.create("room-2"); // any Game instance works for this trivial impl

      const result = store.commit("room-1", replacement);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(store.get("room-1")).toBe(replacement);
      expect(store.get("room-1")).not.toBe(original);
    });
  });

  describe("drop", () => {
    it("removes the game so get returns null", () => {
      const store = makeStore();
      store.create("room-1");

      store.drop("room-1");

      expect(store.get("room-1")).toBeNull();
    });

    it("removes the game from its waiting queue too", () => {
      const store = makeStore();
      store.create("room-1", HUMAN_VS_HUMAN);

      store.drop("room-1");

      expect(store.findWaiting(HUMAN_VS_HUMAN)).toBeNull();
    });

    it("is a no-op for an id that doesn't exist", () => {
      const store = makeStore();

      expect(() => store.drop("missing")).not.toThrow();
    });
  });

  describe("sweep", () => {
    let nowSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
      nowSpy?.mockRestore();
    });

    it("removes empty, unfinished games past emptyTtlMs", () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      store.create("room-1", HUMAN_VS_HUMAN); // never joined -> empty

      nowSpy.mockReturnValue(501); // just past emptyTtlMs

      expect(store.sweep()).toBe(1);
      expect(store.get("room-1")).toBeNull();
    });

    it("keeps empty games that haven't hit emptyTtlMs yet", () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      store.create("room-1", HUMAN_VS_HUMAN);

      nowSpy.mockReturnValue(200);

      expect(store.sweep()).toBe(0);
      expect(store.get("room-1")).not.toBeNull();
    });

    it("keeps waiting games that have one seated player, even if old", () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const game = store.create("room-1", HUMAN_VS_HUMAN);
      game.join(WHITE, makeOccupant("p1")); // no longer empty

      nowSpy.mockReturnValue(10_000); // well past emptyTtlMs

      expect(store.sweep()).toBe(0);
      expect(store.get("room-1")).toBe(game);
    });

    it("keeps active games regardless of age", () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const game = store.create("room-1", HUMAN_VS_HUMAN);
      game.join(WHITE, makeOccupant("p1"));
      game.join(BLACK, makeOccupant("p2")); // ACTIVE

      nowSpy.mockReturnValue(999_999);

      expect(store.sweep()).toBe(0);
      expect(store.get("room-1")).toBe(game);
    });

    it("removes finished games past resultTtlMs, measured from when they finished", async () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const game = store.create("room-1", HUMAN_VS_HUMAN);
      game.join(WHITE, makeOccupant("p1"));
      game.join(BLACK, makeOccupant("p2"));

      // Age the game a lot before it finishes, to prove resultTtlMs is
      // measured from finishedAt, not createdAt.
      nowSpy.mockReturnValue(5000);
      // Fool's Mate isn't needed here; resignation-equivalent isn't modeled
      // on Game directly, so drive an actual checkmate instead.
      const { F2, F3, E7, E5, G2, G4, D8, H4 } = await import("../../chess");
      await game.move(WHITE, { from: F2, to: F3 });
      await game.move(BLACK, { from: E7, to: E5 });
      await game.move(WHITE, { from: G2, to: G4 });
      await game.move(BLACK, { from: D8, to: H4 }); // checkmate, finishedAt = 5000

      nowSpy.mockReturnValue(5000 + 1000); // exactly at resultTtlMs boundary
      expect(store.sweep()).toBe(0); // not yet strictly past

      nowSpy.mockReturnValue(5000 + 1001);
      expect(store.sweep()).toBe(1);
      expect(store.get("room-1")).toBeNull();
    });

    it("keeps finished games until resultTtlMs has passed", async () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const game = store.create("room-1", HUMAN_VS_HUMAN);
      game.join(WHITE, makeOccupant("p1"));
      game.join(BLACK, makeOccupant("p2"));

      const { F2, F3, E7, E5, G2, G4, D8, H4 } = await import("../../chess");
      await game.move(WHITE, { from: F2, to: F3 });
      await game.move(BLACK, { from: E7, to: E5 });
      await game.move(WHITE, { from: G2, to: G4 });
      await game.move(BLACK, { from: D8, to: H4 });

      nowSpy.mockReturnValue(500); // well before resultTtlMs elapses

      expect(store.sweep()).toBe(0);
      expect(store.get("room-1")).toBe(game);
    });

    it("counts and removes multiple expired games in one pass", () => {
      const store = makeStore(1000, 500);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      store.create("room-1", HUMAN_VS_HUMAN);
      store.create("room-2", HUMAN_VS_AI);
      const kept = store.create("room-3", HUMAN_VS_HUMAN);
      kept.join(WHITE, makeOccupant("p1")); // not empty, survives

      nowSpy.mockReturnValue(600);

      expect(store.sweep()).toBe(2);
      expect(store.get("room-1")).toBeNull();
      expect(store.get("room-2")).toBeNull();
      expect(store.get("room-3")).toBe(kept);
    });
  });

  describe("startSweeping / stopSweeping", () => {
    it("periodically sweeps expired games on the given interval", async () => {
      const store = makeStore(1000, 10); // emptyTtlMs = 10ms, easy to clear in real time

      store.create("room-1", HUMAN_VS_HUMAN);
      store.startSweeping(20);

      await new Promise((resolve) => setTimeout(resolve, 60));
      store.stopSweeping();

      expect(store.get("room-1")).toBeNull();
    });

    it("does not leak the previous interval when started twice", async () => {
      const store = makeStore(1000, 10);
      store.create("room-1", HUMAN_VS_HUMAN);

      store.startSweeping(20);
      store.startSweeping(20); // should replace, not stack, the first interval

      await new Promise((resolve) => setTimeout(resolve, 60));
      store.stopSweeping();

      expect(store.get("room-1")).toBeNull();
    });

    it("stops sweeping once stopSweeping is called", async () => {
      const store = makeStore(1000, 10);
      store.startSweeping(20);
      store.stopSweeping();

      store.create("room-1", HUMAN_VS_HUMAN);
      await new Promise((resolve) => setTimeout(resolve, 60));

      // No sweeper running anymore, so the (now-expired) empty game survives.
      expect(store.get("room-1")).not.toBeNull();
    });

    it("is safe to call stopSweeping when nothing was started", () => {
      const store = makeStore();

      expect(() => store.stopSweeping()).not.toThrow();
    });
  });
});
