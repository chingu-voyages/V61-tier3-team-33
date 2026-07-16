import { beforeEach, describe, it } from "bun:test";

import { sql } from "../../../db/postgres";
import type { PlayerStore } from "../player/player-store";
import { PostgresPlayers } from "../player/postgres";
import type { OAuthStore } from "./oauth-store";
import { PostgresOAuth } from "./postgres";
import { testOAuthStore } from "./store-test";

let available = false;
try {
  await sql`SELECT 1`;
  available = true;
} catch {
  // PostgreSQL not reachable — skip integration tests
}

beforeEach(async () => {
  if (!available) return;
  await sql`DELETE FROM oauth`;
  await sql`DELETE FROM players`;
});

function createStore(): { oauth: OAuthStore; players: PlayerStore } {
  const players = new PostgresPlayers();
  return { oauth: new PostgresOAuth(), players };
}

describe("PostgresOAuth", () => {
  if (!available) {
    it.skip("PostgreSQL is not available", () => {});
  } else {
    testOAuthStore(createStore, "PostgresOAuth");
  }
});
