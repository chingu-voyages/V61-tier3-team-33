import { beforeEach, describe, expect, it, mock } from "bun:test";

import { FriendService } from "../../services/friend/service";
import { MemoryFriends } from "../../store/friend/memory";
import { MemoryPlayers } from "../../store/player/memory";
import { err, FRIEND_NOT_FOUND, ok } from "../../types/result";
import { FriendRoutes } from "./routes";

let app: ReturnType<FriendRoutes["plugin"]>;
let service: FriendService;

beforeEach(() => {
  const friends = new MemoryFriends();
  const players = new MemoryPlayers();
  service = new FriendService(friends, players);

  // Mock the service methods
  service.sendRequest = mock(async () => ok());
  service.acceptRequest = mock(async () => ok());
  service.block = mock(async () => ok());
  service.remove = mock(async () => ok());
  service.listFriends = mock(async () => ok([]));
  service.pendingRequests = mock(async () => ok([]));

  app = new FriendRoutes(service).plugin();
});

function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body) {
    headers["content-type"] = "application/json";
  }
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

describe("FriendRoutes", () => {
  it("POST /friends/request", async () => {
    const res = await request("POST", "/friends/request", { from: "p1", to: "p2" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(service.sendRequest).toHaveBeenCalledWith("p1", "p2");
  });

  it("POST /friends/accept", async () => {
    const res = await request("POST", "/friends/accept", { from: "p1", to: "p2" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(service.acceptRequest).toHaveBeenCalledWith("p1", "p2");
  });

  it("POST /friends/block", async () => {
    const res = await request("POST", "/friends/block", { from: "p1", to: "p2" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(service.block).toHaveBeenCalledWith("p1", "p2");
  });

  it("DELETE /friends", async () => {
    const res = await request("DELETE", "/friends", { from: "p1", to: "p2" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(service.remove).toHaveBeenCalledWith("p1", "p2");
  });

  it("GET /friends/:pid", async () => {
    const res = await request("GET", "/friends/p1");
    expect(res.status).toBe(200);
    expect(service.listFriends).toHaveBeenCalledWith("p1");
  });

  it("GET /friends/pending/:pid", async () => {
    const res = await request("GET", "/friends/pending/p1");
    expect(res.status).toBe(200);
    expect(service.pendingRequests).toHaveBeenCalledWith("p1");
  });

  it("returns 400 when service returns error", async () => {
    (service.sendRequest as ReturnType<typeof mock>) = mock(async () => err(FRIEND_NOT_FOUND));
    const res = await request("POST", "/friends/request", { from: "p1", to: "p2" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: FRIEND_NOT_FOUND });
  });
});
