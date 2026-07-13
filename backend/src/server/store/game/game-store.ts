import type { Clock } from "../../clock/clock";
import type { Mode } from "../../types";
import type { ClockFormat } from "../../types";
import type { Game } from "./game";

/** Read-only access to stored games. */
export interface GameReader {
  /** Look up a game by id. Returns null if no game with that id exists. */
  get(id: string): Game | null;

  /** Find a waiting game matching the given mode and clock format. Returns null if none found. */
  findWaiting(mode: Mode, format: ClockFormat): Game | null;
}

/** Creates, updates, and cleans up stored games. */
export interface GameWriter {
  /** Create a new game. Defaults to human-vs-human with a blitz clock and a random id. */
  create(id?: string, mode?: Mode, clock?: Clock): Game;

  /** Replace the game at the given id (used for optimistic concurrency). */
  commit(id: string, game: Game): void;

  /** Remove a game from the store entirely. */
  drop(id: string): void;

  /** Remove all expired games. Returns the number of games removed. */
  sweep(): number;

  /** Start periodic sweeping at the given interval (ms). */
  startSweeping(intervalMs: number): void;

  /** Stop periodic sweeping. */
  stopSweeping(): void;
}

export type GameStore = GameReader & GameWriter;
