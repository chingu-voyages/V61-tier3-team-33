import type { Result } from "../../types/result";
import type { OAuthError } from "../../types/result";
import type { StoreKind } from "../../types/store";
import { MEMORY, POSTGRES } from "../../types/store";
import type { PlayerReader } from "../player/player-store";
import { MemoryOAuth } from "./memory";
import type { OAuthIdentity } from "./oauth-identity";
import { PostgresOAuth } from "./postgres";

export interface OAuthReader {
  findBySubject(provider: "google", sub: string): Promise<Result<OAuthIdentity, OAuthError>>;
  findByPlayerId(playerId: string): Promise<Result<OAuthIdentity, OAuthError>>;
}

export interface OAuthWriter {
  save(identity: OAuthIdentity): Promise<Result<void, OAuthError>>;
}

export type OAuthStore = OAuthReader & OAuthWriter;

export function createOAuthStore(kind: StoreKind, players: PlayerReader): OAuthStore {
  switch (kind) {
    case MEMORY:
      return new MemoryOAuth(players);
    case POSTGRES:
      return new PostgresOAuth();
  }
  throw new Error(`Unknown store kind: ${kind}`);
}
