import { beforeEach, describe, expect, it } from "bun:test";

import { MemoryCredentials } from "../../store/credential/memory";
import { MemoryPlayers } from "../../store/player/memory";
import type { Store } from "../../store/store";
import { MemoryTokens } from "../../store/token/memory";
import { EMAIL_TAKEN, INVALID_CREDENTIALS, USERNAME_TAKEN } from "../../types/result";
import { PasswordAuth } from "./password";

let players: MemoryPlayers;
let credentials: MemoryCredentials;
let tokens: MemoryTokens;
let passwordAuth: PasswordAuth;

function buildStore() {
  return {
    players,
    credentials,
    identities: {} as Store["identities"],
    tokens,
    friends: {} as Store["friends"],
    games: {} as Store["games"],
    sessions: {} as Store["sessions"],
  } satisfies Store;
}

beforeEach(() => {
  players = new MemoryPlayers();
  credentials = new MemoryCredentials(players);
  tokens = new MemoryTokens(players);
  passwordAuth = new PasswordAuth(buildStore());
});

const validRegister = { username: "alice", email: "alice@example.com", password: "correct-horse" };

describe("register", () => {
  it("creates a player and issues a token", async () => {
    const result = await passwordAuth.register(validRegister);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value.playerId).toBe("string");
    expect(typeof result.value.token).toBe("string");
  });

  it("rejects a duplicate email, case-insensitively", async () => {
    await passwordAuth.register(validRegister);
    const result = await passwordAuth.register({
      ...validRegister,
      username: "alice2",
      email: validRegister.email.toUpperCase(),
    });
    expect(result).toEqual({ ok: false, error: EMAIL_TAKEN });
  });

  it("rejects a duplicate username", async () => {
    await passwordAuth.register(validRegister);
    const result = await passwordAuth.register({ ...validRegister, email: "someone-else@example.com" });
    expect(result).toEqual({ ok: false, error: USERNAME_TAKEN });
  });
});

describe("login", () => {
  it("logs in with correct email and password", async () => {
    await passwordAuth.register(validRegister);
    const result = await passwordAuth.login({ login: validRegister.email, password: validRegister.password });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value.playerId).toBe("string");
    expect(typeof result.value.token).toBe("string");
  });

  it("logs in with correct username and password", async () => {
    await passwordAuth.register(validRegister);
    const result = await passwordAuth.login({ login: validRegister.username, password: validRegister.password });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.playerId).toBeDefined();
  });

  it("rejects an unknown email", async () => {
    const result = await passwordAuth.login({ login: "nobody@example.com", password: "whatever1" });
    expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS });
  });

  it("rejects an unknown username", async () => {
    const result = await passwordAuth.login({ login: "nonexistent", password: "whatever1" });
    expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS });
  });

  it("rejects the wrong password", async () => {
    await passwordAuth.register(validRegister);
    const result = await passwordAuth.login({ login: validRegister.email, password: "wrong-password" });
    expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS });
  });
});
