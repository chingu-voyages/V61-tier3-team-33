import { beforeEach, describe, expect, it } from "bun:test";

import { AuthService } from "../../services/auth/service";
import { MemoryCredentials } from "../../store/credential/memory";
import { MemoryOAuth } from "../../store/oauth/memory";
import { MemoryPlayers } from "../../store/player/memory";
import type { Store } from "../../store/store";
import { MemoryTokens } from "../../store/token/memory";
import { AuthRoutes } from "./routes";

process.env.GOOGLE_CLIENT_ID = "test-client-id";

interface GoogleTokenResponse {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
}

let players: MemoryPlayers;
let credentials: MemoryCredentials;
let identities: MemoryOAuth;
let tokens: MemoryTokens;
let app: ReturnType<AuthRoutes["plugin"]>;
let mockFetchResponse: GoogleTokenResponse | null = null;

beforeEach(() => {
  players = new MemoryPlayers();
  credentials = new MemoryCredentials(players);
  identities = new MemoryOAuth(players);
  tokens = new MemoryTokens(players);

  const store: Store = {
    players,
    credentials,
    identities,
    tokens,
    games: {} as Store["games"],
    sessions: {} as Store["sessions"],
  };
  const authService = new AuthService(store);
  app = new AuthRoutes(authService).plugin();

  mockFetchResponse = null;
  globalThis.fetch = (async (_url: string) => {
    if (!mockFetchResponse) {
      return new Response("", { status: 401 });
    }
    return new Response(JSON.stringify(mockFetchResponse), { status: 200 });
  }) as unknown as typeof fetch;
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function authCookieValue(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = /token=([^;]+)/.exec(setCookieHeader);
  return match?.[1] ?? null;
}

const validRegister = { username: "alice", email: "alice@example.com", password: "correct-horse" };

describe("POST /auth/register", () => {
  it("registers a new player and sets the auth cookie", async () => {
    const res = await post("/auth/register", validRegister);
    const body = (await res.json()) as { playerId: string };

    expect(res.status).toBe(200);
    expect(typeof body.playerId).toBe("string");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("token=");
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("rejects a password under 8 characters", async () => {
    const res = await post("/auth/register", { ...validRegister, password: "short" });

    expect(res.status).toBe(422);
  });

  it("rejects a duplicate email with 409", async () => {
    await post("/auth/register", validRegister);
    const res = await post("/auth/register", { ...validRegister, username: "alice2" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(409);
    expect(body.error).toBe("email-taken");
  });

  it("rejects a duplicate username with 409", async () => {
    await post("/auth/register", validRegister);
    const res = await post("/auth/register", { ...validRegister, email: "someone-else@example.com" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(409);
    expect(body.error).toBe("username-taken");
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials and sets the auth cookie", async () => {
    await post("/auth/register", validRegister);
    const res = await post("/auth/login", { login: validRegister.email, password: validRegister.password });
    const body = (await res.json()) as { playerId: string };

    expect(res.status).toBe(200);
    expect(typeof body.playerId).toBe("string");
    expect(res.headers.get("set-cookie")).toContain("token=");
  });

  it("logs in with username and sets the auth cookie", async () => {
    await post("/auth/register", validRegister);
    const res = await post("/auth/login", { login: validRegister.username, password: validRegister.password });
    const body = (await res.json()) as { playerId: string };

    expect(res.status).toBe(200);
    expect(typeof body.playerId).toBe("string");
    expect(res.headers.get("set-cookie")).toContain("token=");
  });

  it("rejects an unknown login with 401", async () => {
    const res = await post("/auth/login", { login: "nobody@example.com", password: "whatever1" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("invalid-credentials");
  });

  it("rejects an unknown username with 401", async () => {
    const res = await post("/auth/login", { login: "nonexistent", password: "whatever1" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("invalid-credentials");
  });

  it("rejects the wrong password with 401", async () => {
    await post("/auth/register", validRegister);
    const res = await post("/auth/login", { login: validRegister.email, password: "wrong-password" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("invalid-credentials");
  });
});

describe("POST /auth/google", () => {
  it("rejects a token that can't be verified with 401", async () => {
    mockFetchResponse = null;
    const res = await post("/auth/google", { idToken: "bad-token" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("invalid-google-token");
  });

  it("creates a new player from a verified profile and sets the auth cookie", async () => {
    mockFetchResponse = {
      aud: "test-client-id",
      sub: "google-sub-1",
      email: "bob@example.com",
      email_verified: "true",
    };
    const res = await post("/auth/google", { idToken: "good-token" });
    const body = (await res.json()) as { playerId: string };

    expect(res.status).toBe(200);
    expect(typeof body.playerId).toBe("string");
    expect(res.headers.get("set-cookie")).toContain("token=");
  });

  it("logs in the same player on a second call with the same subject", async () => {
    mockFetchResponse = {
      aud: "test-client-id",
      sub: "google-sub-2",
      email: "carol@example.com",
      email_verified: "true",
    };
    const first = await post("/auth/google", { idToken: "good-token" });
    const firstBody = (await first.json()) as { playerId: string };

    const second = await post("/auth/google", { idToken: "good-token" });
    const secondBody = (await second.json()) as { playerId: string };

    expect(secondBody.playerId).toBe(firstBody.playerId);
  });
});

describe("GET /auth/me", () => {
  it("returns the player for a valid auth cookie", async () => {
    const registerRes = await post("/auth/register", validRegister);
    const token = authCookieValue(registerRes.headers.get("set-cookie"));

    const res = await app.handle(
      new Request("http://localhost/auth/me", {
        headers: { Cookie: `token=${token}` },
      }),
    );
    const body = (await res.json()) as { playerId: string; username: string };

    expect(res.status).toBe(200);
    expect(body.username).toBe(validRegister.username);
  });

  it("returns 401 with no auth cookie", async () => {
    const res = await app.handle(new Request("http://localhost/auth/me"));
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the auth token and returns 204", async () => {
    const registerRes = await post("/auth/register", validRegister);
    const token = authCookieValue(registerRes.headers.get("set-cookie"));
    expect(token).not.toBeNull();

    const res = await post("/auth/logout", {}, { Cookie: `token=${token}` });
    expect(res.status).toBe(204);

    const lookup = await tokens.findByToken(token as string);
    expect(lookup.ok).toBe(false);
  });

  it("returns 204 even with no auth cookie present", async () => {
    const res = await post("/auth/logout", {});
    expect(res.status).toBe(204);
  });
});
