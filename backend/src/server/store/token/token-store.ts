import type { Result } from "../../types/result";
import type { TokenError } from "../../types/result";
import type { StoreKind } from "../../types/store";
import { MEMORY, POSTGRES } from "../../types/store";
import type { PlayerReader } from "../player/player-store";
import { MemoryTokens } from "./memory";
import { PostgresTokens } from "./postgres";
import type { AuthToken } from "./token";

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenWriter {
  issue(playerId: string): Promise<Result<AuthToken, TokenError>>;
  revoke(token: string): Promise<Result<void, TokenError>>;
}

export interface TokenReader {
  findByToken(token: string): Promise<Result<AuthToken, TokenError>>;
}

export type TokenStore = TokenReader & TokenWriter;

export function createTokenStore(kind: StoreKind, players: PlayerReader): TokenStore {
  switch (kind) {
    case MEMORY:
      return new MemoryTokens(players);
    case POSTGRES:
      return new PostgresTokens();
  }
  throw new Error(`Unknown store kind: ${kind}`);
}
