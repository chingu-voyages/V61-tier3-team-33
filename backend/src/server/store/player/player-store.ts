import type { Result } from "../../types/result";
import type { PlayerError } from "../../types/result";
import type { StoreKind } from "../../types/store";
import { MEMORY, POSTGRES } from "../../types/store";
import { MemoryPlayers } from "./memory";
import type { Player } from "./player";
import { PostgresPlayers } from "./postgres";

export interface PlayerReader {
  findById(id: string): Promise<Result<Player, PlayerError>>;
  findByUsername(username: string): Promise<Result<Player, PlayerError>>;
}

export interface PlayerWriter {
  save(player: Player): Promise<Result<void, PlayerError>>;
}

export type PlayerStore = PlayerReader & PlayerWriter;

export function createPlayerStore(kind: StoreKind): PlayerStore {
  switch (kind) {
    case MEMORY:
      return new MemoryPlayers();
    case POSTGRES:
      return new PostgresPlayers();
  }
  throw new Error(`Unknown store kind: ${kind}`);
}
