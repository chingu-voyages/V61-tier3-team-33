import type { Cookie as ElysiaCookie } from "elysia";

import { TOKEN_TTL_MS } from "../store/token/token-store";

const AUTH_TOKEN_TTL_SECONDS = TOKEN_TTL_MS / 1000;

export const Cookie = {
  token: {
    get(cookie: ElysiaCookie<unknown> | undefined): string | undefined {
      return typeof cookie?.value === "string" && cookie.value ? cookie.value : undefined;
    },

    set(cookie: ElysiaCookie<unknown> | undefined, value: string): void {
      if (!cookie) {
        throw new Error("token cookie is unavailable");
      }
      cookie.set({
        value,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: AUTH_TOKEN_TTL_SECONDS,
        path: "/",
      });
    },

    clear(cookie: ElysiaCookie<unknown> | undefined): void {
      cookie?.remove();
    },
  },
};
