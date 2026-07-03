import type { Brand } from "../../chess/core/brand";
import type { Event } from "../protocol/events";

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

// Anything that can broadcast events. `roomId` is read straight off the
// event (every Event variant carries one, `null` when it isn't scoped to
// a room), so callers never pass it separately.
export interface Publisher {
  emit(event: Event): void;
}

// Anything that can be subscribed to. Priority is optional here for the
// same reason it's optional on Hub itself: most subscribers don't care
// and should get DEFERRED for free. Only pass FAST when a handler's
// latency genuinely matters (see Priority docs above).
export interface Subscriber {
  on<T extends string>(
    type: T,
    handler: Handler<T>,
    priority?: Priority,
  ): Unsubscribe;
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

  // Dispatch an event: fast-lane handlers run immediately (same tick, in
  // order); deferred-lane handlers are each scheduled on their own macrotask
  // so a large fan-out can't block the thread or delay fast-lane delivery.
  // roomId comes from the event's own `roomId` field.
  emit(event: Event): void {
    const roomId = event.roomId;
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

  // Subscribe to one event type; handler gets that event pre-narrowed.
  // Defaults to DEFERRED so a handler only ever blocks the hot path if it
  // explicitly opts into FAST.
  on<T extends string>(
    type: T,
    handler: Handler<T>,
    priority: Priority = DEFERRED,
  ): Unsubscribe {
    const broad = handler as EventHandler; // safe: emit only calls this via the matching type key
    let bucket = this.typed.get(type);
    if (!bucket) {
      bucket = newBucket();
      this.typed.set(type, bucket);
    }
    const set = bucket[priority];
    set?.add(broad);
    return () => set?.delete(broad);
  }

  // Subscribe to every event, regardless of type.
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
