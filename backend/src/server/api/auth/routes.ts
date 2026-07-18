import { type Cookie as ElysiaCookie, Elysia } from "elysia";

import type { AuthService } from "../../services/auth/service";
import type { GoogleInput, LoginInput, RegisterInput } from "../../types/auth";
import { googleSchema, loginSchema, registerSchema } from "../../types/auth";
import { Status } from "../../types/status";
import { Cookie } from "../cookies";

type HandlerCtx<T> = {
  body: T;
  cookie: Record<string, ElysiaCookie<unknown> | undefined>;
  status: (code: number, body?: unknown) => unknown;
};

export class AuthRoutes {
  constructor(private authService: AuthService) {}

  plugin() {
    return new Elysia({ prefix: "/auth" })
      .post("/register", this.register, { body: registerSchema })
      .post("/login", this.login, { body: loginSchema })
      .post("/google", this.google, { body: googleSchema })
      .get("/me", this.me)
      .post("/logout", this.logout);
  }

  private register = async ({ body, cookie: { token }, status }: HandlerCtx<RegisterInput>) => {
    const result = await this.authService.register(body);
    if (!result.ok) {
      return status(Status.auth(result.error), { error: result.error });
    }

    Cookie.token.set(token, result.value.token);

    return { playerId: result.value.playerId, username: result.value.username };
  };

  private login = async ({ body, cookie: { token }, status }: HandlerCtx<LoginInput>) => {
    const result = await this.authService.login(body);
    if (!result.ok) {
      return status(Status.auth(result.error), { error: result.error });
    }

    Cookie.token.set(token, result.value.token);

    return { playerId: result.value.playerId, username: result.value.username };
  };

  private google = async ({ body, cookie: { token }, status }: HandlerCtx<GoogleInput>) => {
    const result = await this.authService.verify(body.idToken);
    if (!result.ok) {
      return status(Status.auth(result.error), { error: result.error });
    }

    Cookie.token.set(token, result.value.token);

    return { playerId: result.value.playerId, username: result.value.username };
  };

  private me = async ({ cookie: { token }, status }: HandlerCtx<unknown>) => {
    const result = await this.authService.identify(Cookie.token.get(token));
    if (!result.ok) {
      return status(Status.auth(result.error), { error: result.error });
    }

    return result.value;
  };

  private logout = async ({ cookie: { token }, status }: HandlerCtx<unknown>) => {
    await this.authService.discard(Cookie.token.get(token));
    Cookie.token.clear(token);
    return status(204);
  };
}
