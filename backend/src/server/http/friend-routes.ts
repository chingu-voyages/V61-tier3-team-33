import { Elysia, t } from "elysia";
import type { FriendService } from "../friend/friend-service";

export const friendRoutes = (friendService: FriendService) => {
  return new Elysia({
    prefix: "/friends",
  })

    // Send friend request
    .post(
      "/request",
      async ({ body, set }) => {
        const result = await friendService.sendRequest(body.from, body.to);

        if (!result.ok) {
          set.status = 400;
          return { error: result.error };
        }

        return { success: true };
      },
      {
        body: t.Object({
          from: t.String(),
          to: t.String(),
        }),
      },
    )

    // Accept request
    .post(
      "/accept",
      async ({ body, set }) => {
        const result = await friendService.acceptRequest(body.from, body.to);

        if (!result.ok) {
          set.status = 400;
          return { error: result.error };
        }

        return { success: true };
      },
      {
        body: t.Object({
          from: t.String(),
          to: t.String(),
        }),
      },
    )

    // Block player
    .post(
      "/block",
      async ({ body, set }) => {
        const result = await friendService.block(body.from, body.to);

        if (!result.ok) {
          set.status = 400;
          return { error: result.error };
        }

        return { success: true };
      },
      {
        body: t.Object({
          from: t.String(),
          to: t.String(),
        }),
      },
    )

    // Remove friend
    .delete(
      "/",
      async ({ body, set }) => {
        const result = await friendService.remove(body.from, body.to);

        if (!result.ok) {
          set.status = 400;
          return { error: result.error };
        }

        return { success: true };
      },
      {
        body: t.Object({
          from: t.String(),
          to: t.String(),
        }),
      },
    )

    // List friends
    .get("/:pid", async ({ params }) => {
      return friendService.listFriends(params.pid);
    })

    // Pending requests
    .get("/pending/:pid", async ({ params }) => {
      return friendService.pendingRequests(params.pid);
    });
};