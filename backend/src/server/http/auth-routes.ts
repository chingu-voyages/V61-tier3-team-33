import { Elysia, t } from "elysia";

import type { RestAuthenticator } from "../auth/rest-authenticator";
import type { TokenStore } from "../store/token/token-store";
import type { AuthError } from "../types/result";
import {
  EMAIL_TAKEN,
  INVALID_CREDENTIALS,
  INVALID_GOOGLE_TOKEN,
  INVALID_PAYLOAD,
  USERNAME_TAKEN,
} from "../types/result";
import type { PlayerStore } from "../store/player/player-store";

const AUTH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function authStatusMap(error: AuthError): number {
  if (error === INVALID_PAYLOAD) return 400;
  if (error === INVALID_CREDENTIALS || error === INVALID_GOOGLE_TOKEN) return 401;
  if (error === EMAIL_TAKEN || error === USERNAME_TAKEN) return 409;
  return 500;
}

export const authRoutes = (restAuthenticator: RestAuthenticator, authTokens: TokenStore,players:PlayerStore) => {
  return new Elysia({ prefix: "/auth" })

    .post(
      "/register",
      async ({ body, cookie: { authToken }, set }) => {
        const result = await restAuthenticator.register(body);
        if (!result.ok) {
          set.status = authStatusMap(result.error);
          return { error: result.error };
        }
        if (!authToken) {
          throw new Error("authToken cookie is unavailable");
        }
        authToken.set({
          value: result.value.authToken,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: AUTH_TOKEN_TTL_SECONDS,
          path: "/",
        });

        return { playerId: result.value.playerId };
      },
      {
        body: t.Object({
          username: t.String(),
          email: t.String(),
          password: t.String(),
        }),
      },
    )

    .post(
      "/login",
      async ({ body, cookie: { authToken }, set }) => {
        const result = await restAuthenticator.login(body);
        if (!result.ok) {
          set.status = authStatusMap(result.error);
          return { error: result.error };
        }
        if (!authToken) {
          throw new Error("authToken cookie is unavailable");
        }
        authToken.set({
          value: result.value.authToken,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: AUTH_TOKEN_TTL_SECONDS,
          path: "/",
        });

        return { playerId: result.value.playerId };
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
        }),
      },
    )

    .post(
      "/google",
      async ({ body, cookie: { authToken }, set }) => {
        const result = await restAuthenticator.loginWithGoogle(body.idToken);
        if (!result.ok) {
          set.status = authStatusMap(result.error);
          return { error: result.error };
        }
        if (!authToken) {
          throw new Error("authToken cookie is unavailable");
        }
        authToken.set({
          value: result.value.authToken,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: AUTH_TOKEN_TTL_SECONDS,
          path: "/",
        });

        return { playerId: result.value.playerId };
      },
      {
        body: t.Object({
          idToken: t.String(),
        }),
      },
    )
    .get("/me", async ({ cookie: { authToken }, set }) => {
      if (!authToken?.value) {
        set.status = 401;
        return {
          error: "Unauthorized",
        };
      }
      const token = authToken.value;

      if (typeof token !== "string") {
        set.status = 401;
        return {
          error: "Unauthorized",
        };
      }
      
      const tokenResult = await authTokens.findByToken(token);

      if (!tokenResult.ok) {
        set.status = 401;
      
        return {
          error: "Unauthorized",
        };
      }
      
      const playerResult = await players.findById(
        tokenResult.value.playerId
      );
      
      if (!playerResult.ok) {
        set.status = 401;
      
        return {
          error: "Unauthorized",
        };
      }
      
      const player = playerResult.value;
      
      return {
        playerId: player.pid,
        username: player.username,
        provider: player.provider,
      };
    })

    .post("/logout", async ({ cookie, set }) => {
      const tokenCookie = cookie?.authToken;

      if (tokenCookie && typeof tokenCookie.value === "string" && tokenCookie.value) {
        await authTokens.revoke(tokenCookie.value);
      }

      tokenCookie?.remove();

      set.status = 204;
      return;
    });
};
