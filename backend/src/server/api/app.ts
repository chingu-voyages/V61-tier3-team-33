import { cors } from "@elysiajs/cors";
import { type AnyElysia, Elysia } from "elysia";

import config from "../../config/config";
import { AuthService } from "../services/auth/service";
import { FriendService } from "../services/friend/service";
import type { Store } from "../store/store";
import { AuthRoutes } from "./auth/routes";
import { FriendRoutes } from "./friend/routes";

export class App {
  readonly plugin: AnyElysia;

  constructor(store: Store) {
    const authService = new AuthService(store);
    const friendService = new FriendService(store.friends, store.players);

    this.plugin = new Elysia()
      .use(cors({ origin: config.clientUrl, credentials: true }))
      .get("/health", () => ({ status: "ok" }))
      .use(new AuthRoutes(authService).plugin())
      .use(new FriendRoutes(friendService).plugin());
  }
}
