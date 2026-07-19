import { beforeEach, describe, it } from "bun:test";

import { sql } from "../../../db/postgres";
import type { PlayerStore } from "./player-store";
import { PostgresPlayers } from "./postgres";
import { testPlayerStore } from "./store-test";

let available = false;
try {
  await sql`SELECT 1`;
  available = true;
} catch {
  // PostgreSQL not reachable — skip integration tests
}

beforeEach(async () => {
  if (!available) return;
  await sql`DELETE FROM players`;
});

function makeStore(): PlayerStore {
  return new PostgresPlayers();
}

describe("PostgresPlayers", () => {
  if (!available) {
    it.skip("PostgreSQL is not available", () => {});
  } else {
    testPlayerStore(makeStore, "PostgresPlayers");
  }
});
