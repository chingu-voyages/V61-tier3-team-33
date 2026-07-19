import { type Cookie as ElysiaCookie, Elysia } from "elysia";

import type { FriendService } from "../../services/friend/service";
import type { FriendRequestInput } from "../../types/friend";
import { friendRequestSchema } from "../../types/friend";

type HandlerCtx<T> = {
  body: T;
  params: Record<string, string | undefined>;
  cookie: Record<string, ElysiaCookie<unknown> | undefined>;
  status: (code: number, body?: unknown) => unknown;
};

export class FriendRoutes {
  constructor(private friendService: FriendService) {}

  plugin() {
    return new Elysia({ prefix: "/friends" })
      .post("/request", this.sendRequest, { body: friendRequestSchema })
      .post("/accept", this.acceptRequest, { body: friendRequestSchema })
      .post("/block", this.block, { body: friendRequestSchema })
      .delete("/", this.remove, { body: friendRequestSchema })
      .get("/:pid", this.list)
      .get("/pending/:pid", this.pending);
  }

  private sendRequest = async ({ body, status }: HandlerCtx<FriendRequestInput>) => {
    const result = await this.friendService.sendRequest(body.from, body.to);
    if (!result.ok) {
      return status(400, { error: result.error });
    }
    return { success: true };
  };

  private acceptRequest = async ({ body, status }: HandlerCtx<FriendRequestInput>) => {
    const result = await this.friendService.acceptRequest(body.from, body.to);
    if (!result.ok) {
      return status(400, { error: result.error });
    }
    return { success: true };
  };

  private block = async ({ body, status }: HandlerCtx<FriendRequestInput>) => {
    const result = await this.friendService.block(body.from, body.to);
    if (!result.ok) {
      return status(400, { error: result.error });
    }
    return { success: true };
  };

  private remove = async ({ body, status }: HandlerCtx<FriendRequestInput>) => {
    const result = await this.friendService.remove(body.from, body.to);
    if (!result.ok) {
      return status(400, { error: result.error });
    }
    return { success: true };
  };

  private list = async ({ params, status }: HandlerCtx<unknown>) => {
    const pid = params.pid;
    if (!pid) return status(400, { error: "invalid-pid" });
    const result = await this.friendService.listFriends(pid);
    if (!result.ok) return status(400, { error: "failed-to-list" });
    return { friends: result.value };
  };

  private pending = async ({ params, status }: HandlerCtx<unknown>) => {
    const pid = params.pid;
    if (!pid) return status(400, { error: "invalid-pid" });
    const result = await this.friendService.pendingRequests(pid);
    if (!result.ok) return status(400, { error: "failed-to-list" });
    return { requests: result.value };
  };
}
