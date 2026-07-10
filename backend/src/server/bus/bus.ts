import type { Brand } from "../../chess/core/brand";
import type { Event } from "../protocol/events";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Hub" });

// Handler that receives every event, regardless of type.
export type EventHandler = (
  roomId: string | null,
  event: Event,
) => Promise<void> | void;

// Handler narrowed to only the event shape matching a given `type`.
export type Handler<T extends string> = (
  roomId: string | null,
  event: Extract<Event, { type: T }>,
) => Promise<void> | void;

// Called when a subscriber throws or rejects.
export type ErrorHandler = (err: unknown) => void;

// Call to stop receiving events.
export type Unsubscribe = () => void;

/**
 * Event delivery priority.
 *
 * - `FAST` (0) — run synchronously, same tick. Use only for the handful of
 *   handlers where latency directly affects game rules/clocks
 *   (e.g. notifying the players actually in a room).
 * - `DEFERRED` (1) — run on a macrotask (setTimeout 0), yielding to the event
 *   loop between each handler. Use for large fan-out: spectators, chat,
 *   logging, tournament feeds, etc. This is the default.
 */
export type Priority = Brand<number, "Priority">;
export const Priority = (value: number): Priority => value as Priority;
export const FAST: Priority = Priority(0);
export const DEFERRED: Priority = Priority(1);

// One event type's subscribers, split by lane so emit() never has to branch per-item.
// Tuple indexed by Priority value (0 = fast, 1 = deferred).
type HandlerBucket = [Set<EventHandler>, Set<EventHandler>];

// All buckets, keyed by event type string.
type HandlerRegistry = Map<string, HandlerBucket>;

const newBucket = (): HandlerBucket => [new Set(), new Set()];

/** Anything that can broadcast events. */
export interface Publisher {
  /**
   * Publishes an event to all subscribers.
   * @param event — the event to broadcast; `roomId` is read straight off the event itself
   */
  emit(event: Event): void;
}

/** Anything that can be subscribed to. Priority defaults to DEFERRED. */
export interface Subscriber {
  /**
   * Subscribes to a specific event type.
   * @param type — event type string to match
   * @param handler — called with `(roomId, event)` when an event of this type fires
   * @param priority — delivery lane; `FAST` runs synchronously, `DEFERRED` runs on a macrotask
   * @returns a function that unsubscribes the handler
   */
  on<T extends string>(
    type: T,
    handler: Handler<T>,
    priority?: Priority,
  ): Unsubscribe;

  /**
   * Subscribes to every event type.
   * @param handler — called with `(roomId, event)` on every event
   * @param priority — delivery lane
   * @returns a function that unsubscribes the handler
   */
  onAny(handler: EventHandler, priority?: Priority): Unsubscribe;
}

export class Hub implements Publisher, Subscriber {
  // handlers keyed by event type
  private typed: HandlerRegistry = new Map();

  // handlers that hear everything
  private wild: HandlerBucket = [new Set(), new Set()];

  constructor(
    private onError: ErrorHandler = (e) => console.error("[Hub]", e),
  ) {}

  /** {@inheritDoc} */
  emit(event: Event): void {
    const roomId = event.roomId;

    log.info("[HUB-emit]", { type: event.type, roomId, hasFast: Boolean(this.typed.get(event.type)?.[0].size), hasDeferred: Boolean(this.typed.get(event.type)?.[1].size) });

    const [fastWild, deferredWild] = this.wild;
    const bucket = this.typed.get(event.type);

    if (bucket) {
      const [fastBucket, deferredBucket] = bucket;
      for (const h of fastBucket) this.run(roomId, event, h);
      for (const h of deferredBucket) {
        setTimeout(() => this.run(roomId, event, h), 0);
      }
    }

    // Wildcard handlers must run regardless of whether anyone has
    // subscribed to this specific event type.
    for (const h of fastWild) this.run(roomId, event, h);
    for (const h of deferredWild) {
      setTimeout(() => this.run(roomId, event, h), 0);
    }
  }

  /** {@inheritDoc} */
  on<T extends string>(
    type: T,
    handler: Handler<T>,
    priority: Priority = DEFERRED,
  ): Unsubscribe {
    const broad = handler as EventHandler;
    let bucket = this.typed.get(type);
    if (!bucket) {
      bucket = newBucket();
      this.typed.set(type, bucket);
    }
    const set = bucket[priority];
    set?.add(broad);
    log.info("[HUB-subscribe]", { type, priority: priority === 0 ? 'FAST' : 'DEFERRED', count: set?.size ?? 0 });
    return () => {
      set?.delete(broad);
      log.info("[HUB-unsubscribe]", { type, count: set?.size ?? 0 });
    };
  }

  /** {@inheritDoc} */
  onAny(handler: EventHandler, priority: Priority = DEFERRED): Unsubscribe {
    const set = this.wild[priority];
    set?.add(handler);
    return () => set?.delete(handler);
  }

  // Run a handler, catching sync throws and async rejections so one bad handler can't break emit.
  // Avoids wrapping every call in Promise.resolve() — most handlers, especially
  // FAST-lane ones, are synchronous, and that wrapper allocates a Promise on
  // every single dispatch for no benefit. We only touch .catch() when the
  // handler actually returned something thenable.
  private run(
    roomId: string | null,
    event: Event,
    handler: EventHandler,
  ): void {
    try {
      const result = handler(roomId, event);
      if (isThenable(result)) result.catch(this.onError);
    } catch (e) {
      this.onError(e);
    }
  }
}

// Duck-type check: avoids importing `Promise` types just to see if we should `.catch()`.
function isThenable(value: unknown): value is Promise<void> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as any).then === "function"
  );
}
