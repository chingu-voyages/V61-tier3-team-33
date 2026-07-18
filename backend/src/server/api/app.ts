import { cors } from "@elysiajs/cors";
import { type AnyElysia, Elysia } from "elysia";

import config from "../../config/config";
import { AuthService } from "../services/auth/service";
import type { Store } from "../store/store";
import { AuthRoutes } from "./auth/routes";

export class App {
  readonly plugin: AnyElysia;

  constructor(store: Store) {
    const authService = new AuthService(store);

    this.plugin = new Elysia()
      .use(cors({ origin: config.clientUrl, credentials: true }))
      .get("/health", () => ({ status: "ok" }))
      .use(new AuthRoutes(authService).plugin());
  }
}
