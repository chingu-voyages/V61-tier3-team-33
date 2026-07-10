import { describe, expect, it, spyOn, afterEach } from "bun:test";
import { Sessions } from "./sessions";
import {
  WHITE,
  HUMAN_VS_HUMAN,
  WS_OPEN,
  type WebSocket,
} from "../types";

describe("Sessions", () => {
  /** A minimal fake WebSocket. Each call makes a distinct object, so two
   * fakes are never === even if constructed identically — this is what lets
   * us exercise identity-keyed lookups (bySocketMap). */
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: () => {},
      close: () => {},
    };
  }

  function makeStore(disconnectedTtlMs = 1000) {
    return new Sessions(disconnectedTtlMs);
  }

  describe("open", () => {
    it("creates a session findable by both the socket and its token", () => {
      const store = makeStore();
      const ws = makeSocket();

      const session = store.open(ws, "player-1");

      expect(store.bySocket(ws)).toBe(session);
      expect(store.byToken(session.token)).toBe(session);
    });

    it("starts with no room/color/mode and disconnectedAt null", () => {
      const store = makeStore();
      const session = store.open(makeSocket(), "player-1");

      expect(session.playerId).toBe("player-1");
      expect(session.roomId).toBeNull();
      expect(session.color).toBeNull();
      expect(session.mode).toBeNull();
      expect(session.disconnectedAt).toBeNull();
    });

    it("gives each session a distinct token", () => {
      const store = makeStore();
      const a = store.open(makeSocket(), "player-1");
      const b = store.open(makeSocket(), "player-2");

      expect(a.token).not.toBe(b.token);
    });
  });

  describe("bySocket", () => {
    it("returns null for a socket that was never opened", () => {
      const store = makeStore();

      expect(store.bySocket(makeSocket())).toBeNull();
    });

    it("distinguishes two different socket objects even with identical shape", () => {
      const store = makeStore();
      const ws1 = makeSocket();
      const ws2 = makeSocket(); // structurally identical, but a different reference
      store.open(ws1, "player-1");

      expect(store.bySocket(ws1)).not.toBeNull();
      expect(store.bySocket(ws2)).toBeNull();
    });
  });

  describe("byToken", () => {
    it("returns null for an unknown token", () => {
      const store = makeStore();

      expect(store.byToken("no-such-token")).toBeNull();
    });
  });

  describe("byPlayerId", () => {
    it("returns the session for a known playerId", () => {
      const store = makeStore();
      const ws = makeSocket();
      const session = store.open(ws, "player-42");

      expect(store.byPlayerId("player-42")).toBe(session);
    });

    it("returns null for an unknown playerId", () => {
      const store = makeStore();
      store.open(makeSocket(), "player-1");

      expect(store.byPlayerId("no-such-player")).toBeNull();
    });

    it("returns null after the session is pruned", () => {
      const store = makeStore(1000);
      const ws = makeSocket();
      const session = store.open(ws, "player-prune");
      store.drop(ws);
      // Simulate time passing past TTL
      const original = Date.now;
      Date.now = () => session.disconnectedAt! + 1001;

      store.prune();

      Date.now = original;
      expect(store.byPlayerId("player-prune")).toBeNull();
    });
  });

  describe("bind", () => {
    it("merges given fields without touching the rest", () => {
      const store = makeStore();
      const ws = makeSocket();
      const session = store.open(ws, "player-1");

      store.bind(ws, { roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(session.roomId).toBe("room-1");
      expect(session.color).toBe(WHITE);
      expect(session.mode).toBe(HUMAN_VS_HUMAN);
      // untouched fields survive the merge
      expect(session.playerId).toBe("player-1");
      expect(session.token).toBeTruthy();
    });

    it("is visible through both bySocket and byToken after binding", () => {
      const store = makeStore();
      const ws = makeSocket();
      const session = store.open(ws, "player-1");

      store.bind(ws, { roomId: "room-1" });

      expect(store.bySocket(ws)?.roomId).toBe("room-1");
      expect(store.byToken(session.token)?.roomId).toBe("room-1");
    });

    it("is a no-op for a socket with no session", () => {
      const store = makeStore();

      expect(() =>
        store.bind(makeSocket(), { roomId: "room-1" }),
      ).not.toThrow();
    });
  });

  describe("drop", () => {
    it("removes the socket index but keeps the session resumable by token", () => {
      const store = makeStore();
      const ws = makeSocket();
      const session = store.open(ws, "player-1");

      store.drop(ws);

      expect(store.bySocket(ws)).toBeNull(); // old socket no longer resolves
      expect(store.byToken(session.token)).not.toBeNull(); // still resumable
      expect(store.byToken(session.token)?.disconnectedAt).not.toBeNull();
    });

    it("is a no-op for a socket with no session", () => {
      const store = makeStore();

      expect(() => store.drop(makeSocket())).not.toThrow();
    });
  });

  describe("resume", () => {
    it("returns null for an unknown token", () => {
      const store = makeStore();

      expect(store.resume("no-such-token", makeSocket())).toBeNull();
    });

    it("reattaches the session to the new socket and clears disconnectedAt", () => {
      const store = makeStore();
      const oldWs = makeSocket();
      const session = store.open(oldWs, "player-1");
      store.drop(oldWs);

      const newWs = makeSocket();
      const resumed = store.resume(session.token, newWs);

      expect(resumed).toBe(session); // same Session object, not a copy
      expect(resumed?.disconnectedAt).toBeNull();
      expect(resumed?.ws).toBe(newWs);
    });

    it("rekeys bySocketMap: the old socket no longer resolves, the new one does", () => {
      const store = makeStore();
      const oldWs = makeSocket();
      const session = store.open(oldWs, "player-1");
      store.drop(oldWs);

      const newWs = makeSocket();
      store.resume(session.token, newWs);

      expect(store.bySocket(oldWs)).toBeNull();
      expect(store.bySocket(newWs)).toBe(session);
    });

    it("works even without a prior drop (e.g. resuming an already-live session)", () => {
      const store = makeStore();
      const oldWs = makeSocket();
      const session = store.open(oldWs, "player-1");

      const newWs = makeSocket();
      const resumed = store.resume(session.token, newWs);

      expect(resumed).toBe(session);
      expect(store.bySocket(oldWs)).toBeNull();
      expect(store.bySocket(newWs)).toBe(session);
    });
  });

  describe("resumeOrOpen", () => {
    it("opens a new session when no token is given", () => {
      const store = makeStore();
      const ws = makeSocket();

      const session = store.resumeOrOpen(ws);

      expect(store.bySocket(ws)).toBe(session);
      expect(session.playerId).toBeTruthy();
    });

    it("opens a new session when the token is unknown", () => {
      const store = makeStore();
      const ws = makeSocket();

      const session = store.resumeOrOpen(ws, "no-such-token");

      expect(store.bySocket(ws)).toBe(session);
      expect(store.byToken("no-such-token")).toBeNull();
    });

    it("resumes the existing session when the token is valid", () => {
      const store = makeStore();
      const oldWs = makeSocket();
      const original = store.open(oldWs, "player-1");
      store.drop(oldWs);

      const newWs = makeSocket();
      const session = store.resumeOrOpen(newWs, original.token);

      expect(session).toBe(original); // same Session object, not a new one
      expect(session.playerId).toBe("player-1");
      expect(store.bySocket(newWs)).toBe(original);
      expect(store.bySocket(oldWs)).toBeNull();
    });

    it("gives each newly created session a distinct playerId", () => {
      const store = makeStore();

      const a = store.resumeOrOpen(makeSocket());
      const b = store.resumeOrOpen(makeSocket());

      expect(a.playerId).not.toBe(b.playerId);
    });
  });

  describe("prune", () => {
    let nowSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
      nowSpy?.mockRestore();
    });

    it("keeps connected sessions regardless of age", () => {
      const store = makeStore(1000);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const ws = makeSocket();
      store.open(ws, "player-1");

      nowSpy.mockReturnValue(999_999); // never disconnected, so never expires

      store.prune();

      expect(store.bySocket(ws)).not.toBeNull();
    });

    it("keeps a disconnected session until disconnectedTtlMs has passed", () => {
      const store = makeStore(1000);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.drop(ws); // disconnectedAt = 0

      nowSpy.mockReturnValue(500); // within the grace window

      store.prune();

      expect(store.byToken(session.token)).not.toBeNull();
    });

    it("removes a disconnected session once disconnectedTtlMs has elapsed", () => {
      const store = makeStore(1000);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.drop(ws); // disconnectedAt = 0

      nowSpy.mockReturnValue(1001);

      store.prune();

      expect(store.byToken(session.token)).toBeNull();
    });

    it("prevents resume once a session has been pruned", () => {
      const store = makeStore(1000);
      nowSpy = spyOn(Date, "now").mockReturnValue(0);
      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.drop(ws);

      nowSpy.mockReturnValue(1001);
      store.prune();

      expect(store.resume(session.token, makeSocket())).toBeNull();
    });
  });

  describe("startPruning / stopPruning", () => {
    it("periodically prunes expired sessions on the given interval", async () => {
      const store = makeStore(10); // disconnectedTtlMs = 10ms, easy to clear in real time
      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.drop(ws);

      store.startPruning(20);
      await new Promise((resolve) => setTimeout(resolve, 60));
      store.stopPruning();

      expect(store.byToken(session.token)).toBeNull();
    });

    it("does not leak the previous timer when started twice", async () => {
      const store = makeStore(10);
      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.drop(ws);

      store.startPruning(20);
      store.startPruning(20); // should replace, not stack, the first timer

      await new Promise((resolve) => setTimeout(resolve, 60));
      store.stopPruning();

      expect(store.byToken(session.token)).toBeNull();
    });

    it("stops pruning once stopPruning is called", async () => {
      const store = makeStore(10);
      store.startPruning(20);
      store.stopPruning();

      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.drop(ws);
      await new Promise((resolve) => setTimeout(resolve, 60));

      // No pruner running anymore, so the (now-expired) session survives.
      expect(store.byToken(session.token)).not.toBeNull();
    });

    it("is safe to call stopPruning when nothing was started", () => {
      const store = makeStore();

      expect(() => store.stopPruning()).not.toThrow();
    });
  });

  describe("prune with playerId cleanup", () => {
    it("removes the old byPlayerId entry when a fresh session is opened with same token resume failure", () => {
      const store = makeStore(1000);
      const ws1 = makeSocket();
      const s1 = store.open(ws1, "player-1");
      const token = s1.token;
      store.drop(ws1);

      // Simulate time passing past TTL
      const original = Date.now;
      Date.now = () => s1.disconnectedAt! + 1001;
      store.prune();
      Date.now = original;

      // Old playerId is gone
      expect(store.byPlayerId("player-1")).toBeNull();

      // New session with old token — resumeOrOpen should open fresh,
      // and the old playerId must not reappear
      const ws2 = makeSocket();
      const s2 = store.resumeOrOpen(ws2, token);

      expect(s2.playerId).not.toBe("player-1");
      expect(store.byPlayerId("player-1")).toBeNull();
      expect(store.bySocket(ws2)).toBe(s2);
    });
  });

  describe("session stability on resume with stale roomId", () => {
    it("clearSession clears roomId, color, and mode", () => {
      const store = makeStore();
      const ws = makeSocket();
      const session = store.open(ws, "player-1");
      store.bind(ws, { roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      store.clearSession(ws);

      expect(session.roomId).toBeNull();
      expect(session.color).toBeNull();
      expect(session.mode).toBeNull();
    });

    it("clearSession is a no-op for unknown socket", () => {
      const store = makeStore();

      expect(() => store.clearSession(makeSocket())).not.toThrow();
    });
  });
});
