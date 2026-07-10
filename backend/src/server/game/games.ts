import type { Publisher, Subscriber } from "../bus/bus";
import { ok, type CommitError, type Result } from "../types";
import { HUMAN_VS_HUMAN, type Mode } from "../types";
import type { Clock } from "../clock/clock";
import { type ClockFormat, BLITZ } from "../types";
import { createClock } from "../clock/factory";
import { ClockTimer } from "../clock/timer";
import { Game } from "./game";
import type { GameStore } from "./game-store";
import { logger } from "../../logging/log";

const log = logger.child({ module: "Games" });

// How long a finished game stays in memory before being swept — long enough
// for a slow client to fetch the final snapshot after the last move/undo.
const RESULTS_TTL_MS = 5 * 60 * 1000;

// How long an empty (no occupants), unfinished game stays in memory —
// e.g. a room that was created but never joined.
const EMPTY_TTL_MS = 60 * 1000;

// How often the sweeper checks for expired games.
const DEFAULT_SWEEP_INTERVAL_MS = 30 * 1000;

function queueKey(mode: Mode, format: ClockFormat): string {
  return `${mode}:${format}`;
}

/** In-memory implementation of GameStore, backed by a Map plus a waiting-game queue per (mode, format). */
export class Games implements GameStore {
  private games: Map<string, Game> = new Map();
  private queue: Map<string, Set<string>> = new Map();
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
  // `DEFAULT` isn't a real clock format the factory knows how to build —
  // createClock() falls back to BlitzClock (format BLITZ) whenever it's
  // asked for DEFAULT or nothing at all. Search under BLITZ here too, or
  // callers that omit `format` never find the games created the same way.
  findWaiting(mode: Mode, format: ClockFormat = BLITZ): Game | null {
    const queue = this.queueFor(mode, format);

    log.info("[GAMES-findWaiting-start]", { mode: mode.toString(), format, queueSize: queue.size });

    for (const id of queue) {
      const game = this.games.get(id);
      if (!game) {
        log.warn("[GAMES-findWaiting-stale]", { id, mode: mode.toString(), format });
        queue.delete(id);
        continue;
      }

      if (game.isWaiting) {
        log.info("[GAMES-findWaiting-hit]", { id, mode: mode.toString(), format, slots: game['slots']?.size ?? 0 });
        return game;
      } else {
        log.info("[GAMES-findWaiting-skip-not-waiting]", { id, mode: mode.toString(), format, status: game.status });
      }
    }

    log.info("[GAMES-findWaiting-miss]", { mode: mode.toString(), format, queueSize: queue.size });
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
      log.info("[GAMES-activation-callback]", { id });
      this.queueFor(mode, clock.format).delete(id);
    });

    this.games.set(id, game);
    this.queueFor(mode, clock.format).add(id);

    log.info("[GAMES-created]", { id, mode: mode.toString(), format: clock.format, totalGames: this.games.size, queueSizes: [...this.queue.entries()].map(([k, v]) => `${k}:${v.size}`).join(',') });

    return game;
  }

  /** {@inheritDoc} */
  // TODO: once Chess/Game become immutable (Stockfish integration), add a
  // real optimistic-concurrency check here — compare against the currently
  // stored game and return err(CONFLICT) on divergence.
  commit(id: string, game: Game): Result<void, CommitError> {
    log.info("[GAMES-commit]", { id, status: game.status, slots: game['slots']?.size ?? 0 });
    this.games.set(id, game);
    return ok();
  }

  /** {@inheritDoc} */
  drop(id: string): void {
    const game = this.games.get(id);
    if (!game) {
      log.warn("[GAMES-drop-miss]", { id });
      return;
    }

    this.games.delete(id);
    this.queue.get(queueKey(game.mode, game.clock.format))?.delete(id);

    log.info("[GAMES-drop]", { id, status: game.status, mode: game.mode.toString(), remaining: this.games.size });
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
    if (count > 0) {
      log.debug("sweep completed", { count, remaining: this.games.size });
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

    log.info("sweeper started", { intervalMs });
  }

  /** {@inheritDoc} */
  stopSweeping(): void {
    if (!this.sweeper) return;

    clearTimeout(this.sweeper);
    this.sweeper = null;

    log.info("sweeper stopped");
  }

  /** The waiting-id queue for `(mode, format)`, creating an empty one on first use. */
  private queueFor(mode: Mode, format: ClockFormat): Set<string> {
    const key = queueKey(mode, format);
    let queue = this.queue.get(key);
    if (!queue) {
      queue = new Set();
      this.queue.set(key, queue);
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
