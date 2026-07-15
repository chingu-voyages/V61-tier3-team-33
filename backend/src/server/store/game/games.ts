import { logger } from "../../../logging/logger";
import type { Clock } from "../../clock/clock";
import { createClock } from "../../clock/factory";
import { ClockTimer } from "../../clock/timer";
import type { Publisher } from "../../events/hub";
import { BLITZ, type ClockFormat, HUMAN_VS_HUMAN, type Mode } from "../../types";
import { Game } from "./game";
import type { GameStore } from "./game-store";

const log = logger.child({ module: "Games" });

const RESULTS_TTL_MS = 5 * 60 * 1000; // finished game TTL
const EMPTY_TTL_MS = 60 * 1000; // never-joined game TTL
const DEFAULT_SWEEP_INTERVAL_MS = 30 * 1000;

function queueKey(mode: Mode, format: ClockFormat): string {
  return `${mode}:${format}`;
}

/** In-memory GameStore: Map + waiting queue per (mode, format). */
export class Games implements GameStore {
  private games: Map<string, Game> = new Map();
  private queue: Map<string, Set<string>> = new Map();
  private sweeper: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private publisher: Publisher,
    private resultTtlMs = RESULTS_TTL_MS,
    private emptyTtlMs = EMPTY_TTL_MS,
  ) {}

  /** Look up a game by id. Returns null if not found. */
  get(id: string): Game | null {
    log.info("[Games.get:start]", { id });
    return this.games.get(id) ?? null;
  }

  /** Find a waiting game for the given mode and format. DEFAULT falls back to BLITZ for matching. */
  findWaiting(mode: Mode, format: ClockFormat = BLITZ): Game | null {
    const queue = this.queueFor(mode, format);
    log.info("[Games.findWaiting:start]", { mode: mode.toString(), format, queueSize: queue.size });

    // scan the queue for a game that is still waiting
    for (const id of queue) {
      const game = this.games.get(id);
      if (!game) {
        log.warn("[Games.findWaiting:stale]", { id, mode: mode.toString(), format });
        queue.delete(id);
        continue;
      }

      if (game.isWaiting) {
        log.info("[Games.findWaiting:hit]", { id, mode: mode.toString(), format, slots: game["slots"]?.size ?? 0 });
        return game;
      } else {
        log.info("[Games.findWaiting:skip-not-waiting]", { id, mode: mode.toString(), format, status: game.status });
      }
    }

    log.info("[Games.findWaiting:miss]", { mode: mode.toString(), format, queueSize: queue.size });
    return null;
  }

  /** Create a new game and add it to the waiting queue. */
  create(id: string = crypto.randomUUID(), mode: Mode = HUMAN_VS_HUMAN, clock: Clock = createClock()): Game {
    const timer = new ClockTimer(clock, id, this.publisher);

    // remove from queue when the game activates (both players seated)
    const game = new Game(id, mode, clock, this.publisher, timer, () => {
      log.info("[Games.create:activation-callback]", { id });
      this.queueFor(mode, clock.format).delete(id);
    });

    this.games.set(id, game);
    this.queueFor(mode, clock.format).add(id);

    log.info("[Games.create:created]", {
      id,
      mode: mode.toString(),
      format: clock.format,
      totalGames: this.games.size,
      queueSizes: [...this.queue.entries()].map(([k, v]) => `${k}:${v.size}`).join(","),
    });

    return game;
  }

  /** Replace the game at the given id. Used for optimistic concurrency. */
  commit(id: string, game: Game): void {
    log.info("[Games.commit:start]", { id, status: game.status, slots: game["slots"]?.size ?? 0 });
    this.games.set(id, game);
  }

  /** Remove a game from the store and its waiting queue. */
  drop(id: string): void {
    const game = this.games.get(id);
    if (!game) {
      log.warn("[Games.drop:miss]", { id });
      return;
    }

    this.games.delete(id);
    this.queue.get(queueKey(game.mode, game.clock.format))?.delete(id);

    log.info("[Games.drop:dropped]", {
      id,
      status: game.status,
      mode: game.mode.toString(),
      remaining: this.games.size,
    });
  }

  /** Remove all expired games. Returns the number of games removed. */
  sweep(): number {
    log.info("[Games.sweep:start]", { totalGames: this.games.size });

    let count = 0;
    for (const [id, game] of this.games) {
      if (this.isExpired(game)) {
        this.drop(id);
        count++;
      }
    }
    if (count > 0) {
      log.info("[Games.sweep:completed]", { count, remaining: this.games.size });
    }
    return count;
  }

  /** Start periodic sweeping at the given interval (ms). */
  startSweeping(intervalMs: number = DEFAULT_SWEEP_INTERVAL_MS): void {
    log.info("[Games.startSweeping:start]", { intervalMs });

    if (this.sweeper) this.stopSweeping();

    const tick = () => {
      this.sweep();
      this.sweeper = setTimeout(tick, intervalMs);
    };

    this.sweeper = setTimeout(tick, intervalMs);
    log.info("[Games.startSweeping:started]", { intervalMs });
  }

  /** Stop periodic sweeping. */
  stopSweeping(): void {
    log.info("[Games.stopSweeping:start]");
    if (!this.sweeper) return;
    clearTimeout(this.sweeper);
    this.sweeper = null;
    log.info("[Games.stopSweeping:stopped]");
  }

  /** Return the waiting queue for the given mode and format, creating it if necessary. */
  private queueFor(mode: Mode, format: ClockFormat): Set<string> {
    const key = queueKey(mode, format);
    let queue = this.queue.get(key);
    if (!queue) {
      queue = new Set();
      this.queue.set(key, queue);
    }
    return queue;
  }

  /** True if finished past resultTtlMs, or empty (never joined) past emptyTtlMs. */
  private isExpired(game: Game): boolean {
    const now = Date.now();

    if (game.isFinished) {
      return game.finishedAt !== null && now - game.finishedAt > this.resultTtlMs;
    }

    if (game.isEmpty) {
      return now - game.createdAt > this.emptyTtlMs;
    }

    return false;
  }
}
