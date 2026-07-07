import type { Publisher, Subscriber } from "../bus/bus";
import { ok, type CommitError, type Result } from "../domain/result";
import { HUMAN_VS_HUMAN, type Mode } from "../domain/types";
import type { Clock } from "../clock/clock";
import { createClock } from "../clock/factory";
import { ClockTimer } from "../clock/timer";
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
    private publisher: Publisher & Subscriber,
    private resultTtlMs = RESULTS_TTL_MS,
    private emptyTtlMs = EMPTY_TTL_MS,
  ) {}

  /** {@inheritDoc} */
  get(id: string): Game | null {
    return this.games.get(id) ?? null;
  }

  /** {@inheritDoc} */
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

  /** {@inheritDoc} */
  create(
    id: string = crypto.randomUUID(),
    mode: Mode = HUMAN_VS_HUMAN,
    clock: Clock = createClock(),
  ): Game {
    const timer = new ClockTimer(clock, id, this.publisher);
    const game = new Game(id, mode, clock, this.publisher, timer, () => {
      this.queueFor(mode).delete(id);
    });

    this.games.set(id, game);
    this.queueFor(mode).add(id);

    return game;
  }

  /** {@inheritDoc} */
  // TODO: once Chess/Game become immutable (Stockfish integration), add a
  // real optimistic-concurrency check here — compare against the currently
  // stored game and return err(CONFLICT) on divergence.
  commit(id: string, game: Game): Result<void, CommitError> {
    this.games.set(id, game);
    return ok();
  }

  /** {@inheritDoc} */
  drop(id: string): void {
    const game = this.games.get(id);
    if (!game) return;

    this.games.delete(id);
    this.queue.get(game.mode)?.delete(id);
  }

  /** {@inheritDoc} */
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

  /** {@inheritDoc} */
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

  /** {@inheritDoc} */
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
