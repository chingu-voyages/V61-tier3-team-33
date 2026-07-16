import { beforeEach, describe, it } from "bun:test";

import { sql } from "../../../db/postgres";
import type { PlayerStore } from "../player/player-store";
import { PostgresPlayers } from "../player/postgres";
import { PostgresTokens } from "./postgres";
import { testTokenStore } from "./store-test";
import type { TokenStore } from "./token-store";

let available = false;
try {
  await sql`SELECT 1`;
  available = true;
} catch {
  // PostgreSQL not reachable — skip integration tests
}

beforeEach(async () => {
  if (!available) return;
  await sql`DELETE FROM tokens`;
  await sql`DELETE FROM players`;
});

function createStore(): { tokens: TokenStore; players: PlayerStore } {
  const players = new PostgresPlayers();
  return { tokens: new PostgresTokens(), players };
}

describe("PostgresTokens", () => {
  if (!available) {
    it.skip("PostgreSQL is not available", () => {});
  } else {
    testTokenStore(createStore, "PostgresTokens");
  }
});
