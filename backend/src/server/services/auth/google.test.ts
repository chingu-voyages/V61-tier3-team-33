import { beforeEach, describe, expect, it } from "bun:test";

import { MemoryOAuth } from "../../store/oauth/memory";
import { MemoryPlayers } from "../../store/player/memory";
import { PASSWORD, Player } from "../../store/player/player";
import type { Store } from "../../store/store";
import { MemoryTokens } from "../../store/token/memory";
import type { Result } from "../../types/result";
import { err, INVALID_GOOGLE_TOKEN, ok } from "../../types/result";
import type { CheckError } from "./google";
import { GoogleAuth, type GoogleProfile } from "./google";

class FakeGoogleAuth extends GoogleAuth {
  profile: GoogleProfile | null = null;

  constructor(store: Pick<Store, "identities" | "players" | "tokens">) {
    super(store);
  }

  override async check(_idToken: string): Promise<Result<GoogleProfile, CheckError>> {
    if (!this.profile) {
      return err(INVALID_GOOGLE_TOKEN);
    }
    return ok(this.profile);
  }
}

let players: MemoryPlayers;
let identities: MemoryOAuth;
let tokens: MemoryTokens;
let googleAuth: FakeGoogleAuth;

function buildStore() {
  const store: Pick<Store, "identities" | "players" | "tokens"> = {
    players,
    identities,
    tokens,
  };
  return store;
}

beforeEach(() => {
  players = new MemoryPlayers();
  identities = new MemoryOAuth(players);
  tokens = new MemoryTokens(players);
  googleAuth = new FakeGoogleAuth(buildStore());
});

describe("GoogleAuth.signin", () => {
  it("rejects a token the verifier can't confirm", async () => {
    googleAuth.profile = null;
    const result = await googleAuth.signin("bad-token");
    expect(result).toEqual({ ok: false, error: INVALID_GOOGLE_TOKEN });
  });

  it("rejects a verified profile with no email", async () => {
    googleAuth.profile = { sub: "google-sub-x", email: "", emailVerified: true };
    const result = await googleAuth.signin("good-token");
    expect(result).toEqual({ ok: false, error: INVALID_GOOGLE_TOKEN });
  });

  it("rejects an unverified email", async () => {
    googleAuth.profile = { sub: "google-sub-y", email: "unverified@example.com", emailVerified: false };
    const result = await googleAuth.signin("good-token");
    expect(result).toEqual({ ok: false, error: INVALID_GOOGLE_TOKEN });
  });

  it("creates a new player and identity for a first-time subject", async () => {
    googleAuth.profile = { sub: "google-sub-1", email: "bob@example.com", emailVerified: true };
    const result = await googleAuth.signin("good-token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const identity = await identities.findBySubject("google", "google-sub-1");
    expect(identity.ok).toBe(true);
    if (identity.ok) expect(identity.value.playerId).toBe(result.value.playerId);
  });

  it("logs in the same player on a repeat call, without creating a second identity", async () => {
    googleAuth.profile = { sub: "google-sub-2", email: "carol@example.com", emailVerified: true };
    const first = await googleAuth.signin("good-token");
    const second = await googleAuth.signin("good-token");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.playerId).toBe(first.value.playerId);
  });

  it("appends a suffix when the derived username is already taken", async () => {
    const store = buildStore();
    googleAuth = new FakeGoogleAuth(store);
    const existing = Player.create("dave", PASSWORD);
    await players.save(existing);

    googleAuth.profile = { sub: "google-sub-3", email: "dave@gmail.com", emailVerified: true };
    const result = await googleAuth.signin("good-token");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const player = await players.findById(result.value.playerId);
    expect(player.ok).toBe(true);
    if (player.ok) {
      expect(player.value.username).not.toBe("dave");
      expect(player.value.username.startsWith("dave-")).toBe(true);
    }
  });
});
