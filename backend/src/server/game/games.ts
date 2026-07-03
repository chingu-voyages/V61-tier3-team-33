import type { Publisher } from "../bus/bus";
import { ok, type CommitError, type Result } from "../domain/result";
import { HUMAN_VS_HUMAN, type Mode } from "../domain/types";
import { Game } from "./game";
import type { GameStore } from "./game-store";

// How long a finished game stays in memory before being swept — long enough
// for a slow client to fetch the final snapshot after the last move/undo.
const RESULTS_TTL_MS = 5 * 60 * 1000;

// How long an empty (no occupants), unfinished game stays in memory —
// e.g. a room that was created but never joined.
const EMPTY_TTL_MS = 60 * 1000;

// How often the sweeper checks for expired games.
const DEFAULT_SWEEP_INTERVAL_MS = 30 * 1000;

/** In-memory implementation of GameStore, backed by a Map plus a waiting-game queue per mode. */
export class Games implements GameStore {
  private games: Map<string, Game> = new Map();
  private queue: Map<Mode, Set<string>> = new Map();
  private sweeper: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private publisher: Publisher,
    private resultTtlMs = RESULTS_TTL_MS,
    private emptyTtlMs = EMPTY_TTL_MS,
  ) {}

  /** Looks up a game by id, or null if it doesn't exist. */
  get(id: string): Game | null {
    return this.games.get(id) ?? null;
  }

  /**
   * Returns the oldest still-waiting game for `mode`, or null if none.
   * Self-heals: discards any stale ids it encounters (present in the
   * queue but no longer in `this.games`, which shouldn't normally happen
   * since `drop` keeps both in sync, but this guards against it anyway).
   */
  findWaiting(mode: Mode): Game | null {
    const queue = this.queueFor(mode);

    for (const id of queue) {
      const game = this.games.get(id);
      if (!game) {
        queue.delete(id);
        continue;
      }

      if (game.isWaiting) {
        return game;
      }
    }

    return null;
  }

  /**
   * Creates and stores a new game, generating an id if none is given.
   * The game starts WAITING and is enqueued for its mode; it's
   * automatically dequeued once it goes ACTIVE (see the `onActivated`
   * callback passed into `Game`).
   */
  create(id: string = crypto.randomUUID(), mode: Mode = HUMAN_VS_HUMAN): Game {
    const game = new Game(id, mode, this.publisher, () => {
      this.queueFor(mode).delete(id);
    });

    this.games.set(id, game);
    this.queueFor(mode).add(id);

    return game;
  }

  /**
   * Persists a new state for an existing game. Currently trivial (always
   * succeeds) since `Game` mutates in place under its own mutex, so there's
   * no actual conflict to detect yet.
   *
   * TODO: once Chess/Game become immutable (Stockfish integration), add a
   * real optimistic-concurrency check here — compare against the currently
   * stored game and return err(CONFLICT) on divergence.
   */
  commit(id: string, game: Game): Result<void, CommitError> {
    this.games.set(id, game);
    return ok();
  }

  /** Removes the game from both the store and its waiting queue, if present. */
  drop(id: string): void {
    const game = this.games.get(id);
    if (!game) return;

    this.games.delete(id);
    this.queue.get(game.mode)?.delete(id);
  }

  /** Drops every expired game (see `isExpired`) and returns how many were removed. */
  sweep(): number {
    let count = 0;
    for (const [id, game] of this.games) {
      if (this.isExpired(game)) {
        this.drop(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Begins periodic sweeping every `intervalMs`. Restarts cleanly if already
   * running.
   *
   * Uses a self-rescheduling `setTimeout` rather than `setInterval`: the
   * next sweep is only scheduled once the current one has fully returned,
   * so overlapping sweeps are structurally impossible — including if
   * `sweep()` ever becomes async in the future.
   */
  startSweeping(intervalMs: number = DEFAULT_SWEEP_INTERVAL_MS): void {
    if (this.sweeper) {
      this.stopSweeping();
    }

    const tick = () => {
      this.sweep();
      this.sweeper = setTimeout(tick, intervalMs);
    };

    this.sweeper = setTimeout(tick, intervalMs);
  }

  /** Stops periodic sweeping started by `startSweeping`. Safe to call if not running. */
  stopSweeping(): void {
    if (!this.sweeper) return;

    clearTimeout(this.sweeper);
    this.sweeper = null;
  }

  /** The waiting-id queue for `mode`, creating an empty one on first use. */
  private queueFor(mode: Mode): Set<string> {
    let queue = this.queue.get(mode);
    if (!queue) {
      queue = new Set();
      this.queue.set(mode, queue);
    }
    return queue;
  }

  /**
   * True if `game` should be swept: either finished and past `resultTtlMs`
   * since it finished, or empty (never joined) and past `emptyTtlMs` since
   * creation. Active games, and waiting games with a seated player, are
   * never expired regardless of age.
   */
  private isExpired(game: Game): boolean {
    const now = Date.now();

    if (game.isFinished) {
      return (
        game.finishedAt !== null && now - game.finishedAt > this.resultTtlMs
      );
    }

    if (game.isEmpty) {
      return now - game.createdAt > this.emptyTtlMs;
    }

    return false;
  }
}
