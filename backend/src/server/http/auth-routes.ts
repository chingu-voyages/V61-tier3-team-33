import { Elysia, t } from "elysia";

import { AuthError } from "../auth/auth-error";
import type { AuthTokens } from "../auth/auth-token";
import type { RestAuthenticator } from "../auth/rest-authenticator";

// Q2: 30 days in seconds (30 * 24 * 60 * 60)
const AUTH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const authRoutes = (restAuthenticator: RestAuthenticator, authTokens: AuthTokens) => {
  return (
    new Elysia({ prefix: "/auth" })
      // Map AuthError codes directly to HTTP Status Codes (C45)
      .error({
        AUTH_ERROR: AuthError,
      })
      .onError(({ code, error, set }) => {
        if (code === "AUTH_ERROR") {
          const authError = error as AuthError;

          const statusMap: Record<string, number> = {
            INVALID_PAYLOAD: 400,
            INVALID_CREDENTIALS: 401,
            INVALID_GOOGLE_TOKEN: 401,
            EMAIL_TAKEN: 409,
            USERNAME_TAKEN: 409,
            INTERNAL_ERROR: 500,
          };

          set.status = statusMap[authError.code] ?? 500;
          return { error: authError.code };
        }
      })

      // POST /auth/register
      .post(
        "/register",
        async ({ body, cookie: { authToken } }) => {
          const result = await restAuthenticator.register(body);
          if (!authToken) {
            throw new Error("authToken cookie is unavailable");
          }
          // C46: Set HttpOnly, Secure, SameSite=Lax cookie
          authToken.set({
            value: result.authToken,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: AUTH_TOKEN_TTL_SECONDS,
            path: "/",
          });

          return { playerId: result.playerId };
        },
        {
          body: t.Object({
            username: t.String(),
            email: t.String(),
            password: t.String(),
          }),
        },
      )

      // POST /auth/login
      .post(
        "/login",
        async ({ body, cookie: { authToken } }) => {
          const result = await restAuthenticator.login(body);
          if (!authToken) {
            throw new Error("authToken cookie is unavailable");
          }
          authToken.set({
            value: result.authToken,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: AUTH_TOKEN_TTL_SECONDS,
            path: "/",
          });

          return { playerId: result.playerId };
        },
        {
          body: t.Object({
            email: t.String(),
            password: t.String(),
          }),
        },
      )

      // POST /auth/google
      .post(
        "/google",
        async ({ body, cookie: { authToken } }) => {
          const result = await restAuthenticator.loginWithGoogle(body.idToken);
          if (!authToken) {
            throw new Error("authToken cookie is unavailable");
          }
          authToken.set({
            value: result.authToken,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: AUTH_TOKEN_TTL_SECONDS,
            path: "/",
          });

          return { playerId: result.playerId };
        },
        {
          body: t.Object({
            idToken: t.String(),
          }),
        },
      )

      // POST /auth/logout (C29, C30)
      // POST /auth/logout (C29, C30)
      .post("/logout", async ({ cookie, set }) => {
        // Safely access the cookie from the dictionary object
        const tokenCookie = cookie?.authToken;

        // Ensure it is a valid string value before calling revoke (C29)
        if (tokenCookie && typeof tokenCookie.value === "string" && tokenCookie.value) {
          // Revoke the token back-end registry record asynchronously
          await authTokens.revoke(tokenCookie.value);
        }

        // Clear cookie immediately via Max-Age=0 expiration if it exists
        tokenCookie?.remove();

        set.status = 204;
        return; // 204 No Content should return no body
      })
  );
};
