import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";

import { friendRoutes } from "./friend-routes";
import type { FriendService } from "../friend/friend-service";
import { ok, err, FRIEND_NOT_FOUND } from "../types/result";

const createFriendService = (): FriendService => ({
  sendRequest: mock(async () => ok()),
  acceptRequest: mock(async () => ok()),
  block: mock(async () => ok()),
  remove: mock(async () => ok()),
  listFriends: mock(async () => ok([])),
  pendingRequests: mock(async () => ok([])),
});

describe("friend routes", () => {
  it("POST /friends/request", async () => {
    const service = createFriendService();

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: "p1",
          to: "p2",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
    });

    expect(service.sendRequest).toHaveBeenCalledWith("p1", "p2");
  });

  it("POST /friends/accept", async () => {
    const service = createFriendService();

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: "p1",
          to: "p2",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
    });

    expect(service.acceptRequest).toHaveBeenCalledWith("p1", "p2");
  });

  it("POST /friends/block", async () => {
    const service = createFriendService();

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends/block", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: "p1",
          to: "p2",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
    });

    expect(service.block).toHaveBeenCalledWith("p1", "p2");
  });

  it("DELETE /friends", async () => {
    const service = createFriendService();

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: "p1",
          to: "p2",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
    });

    expect(service.remove).toHaveBeenCalledWith("p1", "p2");
  });

  it("GET /friends/:pid", async () => {
    const service = createFriendService();

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends/p1"),
    );

    expect(res.status).toBe(200);

    expect(service.listFriends).toHaveBeenCalledWith("p1");
  });

  it("GET /friends/pending/:pid", async () => {
    const service = createFriendService();

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends/pending/p1"),
    );

    expect(res.status).toBe(200);

    expect(service.pendingRequests).toHaveBeenCalledWith("p1");
  });

  it("returns 400 when service returns error", async () => {
    const service = createFriendService();

    service.sendRequest = mock(async () => err(FRIEND_NOT_FOUND));

    const app = new Elysia().use(friendRoutes(service));

    const res = await app.handle(
      new Request("http://localhost/friends/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: "p1",
          to: "p2",
        }),
      }),
    );

    expect(res.status).toBe(400);

    expect(await res.json()).toEqual({
      error: FRIEND_NOT_FOUND,
    });
  });
});