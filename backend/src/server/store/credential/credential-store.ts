import type { CredentialError } from "../../types/result";
import type { Result } from "../../types/result";
import type { StoreKind } from "../../types/store";
import { MEMORY, POSTGRES } from "../../types/store";
import type { PlayerReader } from "../player/player-store";
import type { PasswordCredential } from "./credential";
import { MemoryCredentials } from "./memory";
import { PostgresCredentials } from "./postgres";

export interface CredentialReader {
  findByEmail(email: string): Promise<Result<PasswordCredential, CredentialError>>;
  findByPlayerId(playerId: string): Promise<Result<PasswordCredential, CredentialError>>;
}

export interface CredentialWriter {
  save(credential: PasswordCredential): Promise<Result<void, CredentialError>>;
}

export type CredentialStore = CredentialReader & CredentialWriter;

export function createCredentialStore(kind: StoreKind, players: PlayerReader): CredentialStore {
  switch (kind) {
    case MEMORY:
      return new MemoryCredentials(players);
    case POSTGRES:
      return new PostgresCredentials();
  }
  throw new Error(`Unknown store kind: ${kind}`);
}
