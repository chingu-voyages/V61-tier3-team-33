import type { Mode } from "../domain/types";
import type { Result } from "../domain/result";
import type { CommitError } from "../domain/result";
import type { Game } from "./game";

/** Read-only — services that need to find games but never mutate them. */
export interface GameReader {
  /** Looks up a game by id, or null if it doesn't exist. */
  get(id: string): Game | null;
  /** Finds an open game waiting for a second player in this mode, if any. */
  findWaiting(mode: Mode): Game | null;
}

/** Write — services that mutate games. */
export interface GameWriter {
  /** Creates and stores a new game, generating an id if none is given. */
  create(id?: string, mode?: Mode): Game;
  /** Persists a new state for an existing game; fails on a stale/conflicting write. */
  commit(id: string, game: Game): Result<void, CommitError>;
  /** Removes the game, e.g. once it's finished and no longer needed. */
  drop(id: string): void;
  /** Removes all abandoned/expired games immediately, returning how many were swept. */
  sweep(): number;
  /** Begins periodic sweeping of abandoned games every intervalMs. */
  startSweeping(intervalMs: number): void;
  /** Stops periodic sweeping started by startSweeping. */
  stopSweeping(): void;
}

/** Combined — (GameReader & GameWriter) */
export type GameStore = GameReader & GameWriter;
