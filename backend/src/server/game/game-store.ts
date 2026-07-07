import type { Mode } from "../domain/types";
import type { Result } from "../domain/result";
import type { CommitError } from "../domain/result";
import type { Clock } from "../clock/clock";
import type { Game } from "./game";

/** Read-only — services that need to find games but never mutate them. */
export interface GameReader {
  /**
   * Looks up a game by id, or null if it doesn't exist.
   * @param id — game/room identifier
   */
  get(id: string): Game | null;

  /**
   * Finds an open game waiting for a second player in this mode, if any.
   * @param mode — game mode to match
   */
  findWaiting(mode: Mode): Game | null;
}

/** Write — services that mutate games. */
export interface GameWriter {
  /**
   * Creates and stores a new game, generating an id if none is given.
   * @param id — optional room id (auto-generated if omitted)
   */
  create(id?: string, mode?: Mode, clock?: Clock): Game;
  /**
   * Persists a new state for an existing game; fails on a stale/conflicting write.
   * @param id — game to persist
   */
  commit(id: string, game: Game): Result<void, CommitError>;
  /**
   * Removes the game, e.g. once it's finished and no longer needed.
   * @param id — game to remove
   */
  drop(id: string): void;
  /**
   * Removes all abandoned/expired games immediately.
   * @returns how many expired games were removed
   */
  sweep(): number;
  /**
   * Begins periodic sweeping of abandoned games every intervalMs.
   * @param intervalMs — ms between sweep cycles
   */
  startSweeping(intervalMs: number): void;
  /** Stops periodic sweeping started by startSweeping. */
  stopSweeping(): void;
}

/** Combined — (GameReader & GameWriter) */
export type GameStore = GameReader & GameWriter;
