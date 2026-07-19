import { beforeEach, describe, it } from "bun:test";

import { sql } from "../../../db/postgres";
import type { PlayerStore } from "../player/player-store";
import { PostgresPlayers } from "../player/postgres";
import type { CredentialStore } from "./credential-store";
import { PostgresCredentials } from "./postgres";
import { testCredentialStore } from "./store-test";

let available = false;
try {
  await sql`SELECT 1`;
  available = true;
} catch {
  // PostgreSQL not reachable — skip integration tests
}

beforeEach(async () => {
  if (!available) return;
  await sql`DELETE FROM creds`;
  await sql`DELETE FROM players`;
});

function createStore(): { creds: CredentialStore; players: PlayerStore } {
  const players = new PostgresPlayers();
  return { creds: new PostgresCredentials(), players };
}

describe("PostgresCredentials", () => {
  if (!available) {
    it.skip("PostgreSQL is not available", () => {});
  } else {
    testCredentialStore(createStore, "PostgresCredentials");
  }
});
