import { describe, expect, it, mock } from "bun:test";
import { Hub, FAST, DEFERRED } from "./bus";
import { CONNECTION_OPENED, ROOM_JOINED } from "../protocol/events";
import type { Event } from "../protocol/events";
import { WHITE } from "../types";
import type { GameSnapshot } from "../types";

describe("Hub", () => {
  // Minimal valid events for each type used below.
  const opened: Event = {
    type: CONNECTION_OPENED,
    playerId: "p1",
    ws: {},
    roomId: null,
  };
  const joined: Event = {
    type: ROOM_JOINED,
    roomId: "room-1",
    color: WHITE,
    state: {} as GameSnapshot,
  };

  it("delivers an event only to handlers registered for that type", () => {
    const hub = new Hub();
    const joinedHandler = mock(() => {});
    const openedHandler = mock(() => {});

    hub.on(ROOM_JOINED, joinedHandler, FAST);
    hub.on(CONNECTION_OPENED, openedHandler, FAST);

    hub.emit(joined);

    expect(joinedHandler).toHaveBeenCalledTimes(1);
    expect(joinedHandler).toHaveBeenCalledWith("room-1", joined);
    expect(openedHandler).not.toHaveBeenCalled();
  });

  it("narrows the event type for typed handlers", () => {
    const hub = new Hub();
    let seenRoomId: string | undefined;

    hub.on(
      ROOM_JOINED,
      (_roomId, event) => {
        seenRoomId = event.roomId;
      },
      FAST,
    );

    hub.emit(joined);

    expect(seenRoomId).toBe("room-1");
  });

  it("passes roomId as null for events whose own roomId is null", () => {
    const hub = new Hub();
    const handler = mock(() => {});

    hub.on(CONNECTION_OPENED, handler, FAST);
    hub.emit(opened);

    expect(handler).toHaveBeenCalledWith(null, opened);
  });

  it("delivers every event to wildcard handlers, regardless of type", () => {
    const hub = new Hub();
    const wildcard = mock(() => {});

    hub.onAny(wildcard, FAST);

    hub.emit(joined);
    hub.emit(opened);

    expect(wildcard).toHaveBeenCalledTimes(2);
    expect(wildcard).toHaveBeenNthCalledWith(1, "room-1", joined);
    expect(wildcard).toHaveBeenNthCalledWith(2, null, opened);
  });

  it("notifies both typed and wildcard handlers for the same event", () => {
    const hub = new Hub();
    const typed = mock(() => {});
    const wildcard = mock(() => {});

    hub.on(ROOM_JOINED, typed, FAST);
    hub.onAny(wildcard, FAST);

    hub.emit(joined);

    expect(typed).toHaveBeenCalledTimes(1);
    expect(wildcard).toHaveBeenCalledTimes(1);
  });

  it("notifies wildcard handlers even when no one subscribed for that type", () => {
    const hub = new Hub();
    const wildcard = mock(() => {});

    hub.onAny(wildcard, FAST);
    hub.emit(joined);

    expect(wildcard).toHaveBeenCalledTimes(1);
  });

  it("supports multiple handlers for the same event type", () => {
    const hub = new Hub();
    const first = mock(() => {});
    const second = mock(() => {});

    hub.on(ROOM_JOINED, first, FAST);
    hub.on(ROOM_JOINED, second, FAST);

    hub.emit(joined);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("supports multiple wildcard handlers", () => {
    const hub = new Hub();
    const first = mock(() => {});
    const second = mock(() => {});

    hub.onAny(first, FAST);
    hub.onAny(second, FAST);

    hub.emit(joined);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("the same handler object registered twice fires only once (Set dedup)", () => {
    const hub = new Hub();
    const handler = mock(() => {});

    hub.on(ROOM_JOINED, handler, FAST);
    hub.on(ROOM_JOINED, handler, FAST);

    hub.emit(joined);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does nothing when emitting an event type with no subscribers", () => {
    const hub = new Hub();
    expect(() => hub.emit(joined)).not.toThrow();
  });

  it("on() returns an unsubscribe function that stops future delivery", () => {
    const hub = new Hub();
    const handler = mock(() => {});

    const unsubscribe = hub.on(ROOM_JOINED, handler, FAST);
    hub.emit(joined);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    hub.emit(joined);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("onAny() returns an unsubscribe function that stops future delivery", () => {
    const hub = new Hub();
    const handler = mock(() => {});

    const unsubscribe = hub.onAny(handler, FAST);
    hub.emit(joined);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    hub.emit(joined);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing one handler doesn't affect others on the same type", () => {
    const hub = new Hub();
    const first = mock(() => {});
    const second = mock(() => {});

    const unsubscribeFirst = hub.on(ROOM_JOINED, first, FAST);
    hub.on(ROOM_JOINED, second, FAST);

    unsubscribeFirst();
    hub.emit(joined);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing one wildcard handler doesn't affect others", () => {
    const hub = new Hub();
    const first = mock(() => {});
    const second = mock(() => {});

    const unsubFirst = hub.onAny(first, FAST);
    hub.onAny(second, FAST);

    unsubFirst();
    hub.emit(joined);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("calling unsubscribe twice is a harmless no-op", () => {
    const hub = new Hub();
    const handler = mock(() => {});

    const unsubscribe = hub.on(ROOM_JOINED, handler, FAST);
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();

    hub.emit(joined);
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe for one type does not affect handlers on other types", () => {
    const hub = new Hub();
    const joinedHandler = mock(() => {});
    const openedHandler = mock(() => {});

    const unsubJoined = hub.on(ROOM_JOINED, joinedHandler, FAST);
    hub.on(CONNECTION_OPENED, openedHandler, FAST);

    unsubJoined();
    hub.emit(joined);
    hub.emit(opened);

    expect(joinedHandler).not.toHaveBeenCalled();
    expect(openedHandler).toHaveBeenCalledTimes(1);
  });

  it("re-subscribing after unsubscribe works", () => {
    const hub = new Hub();
    const handler = mock(() => {});

    const unsub = hub.on(ROOM_JOINED, handler, FAST);
    unsub();

    hub.on(ROOM_JOINED, handler, FAST);
    hub.emit(joined);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("FAST handlers run synchronously during emit", () => {
    const hub = new Hub();
    const events: string[] = [];

    hub.on(
      ROOM_JOINED,
      () => {
        events.push("fast");
      },
      FAST,
    );
    hub.emit(joined);

    expect(events).toEqual(["fast"]);
  });

  it("DEFERRED handlers run asynchronously after emit returns", async () => {
    const hub = new Hub();
    const events: string[] = [];

    hub.on(
      ROOM_JOINED,
      () => {
        events.push("deferred");
      },
      DEFERRED,
    );
    hub.emit(joined);

    expect(events).toEqual([]);

    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual(["deferred"]);
  });

  it("FAST handlers run synchronously before DEFERRED handlers for the same event type", async () => {
    const hub = new Hub();
    const order: string[] = [];

    hub.on(
      ROOM_JOINED,
      () => {
        order.push("fast");
      },
      FAST,
    );
    hub.on(
      ROOM_JOINED,
      () => {
        order.push("deferred");
      },
      DEFERRED,
    );
    hub.emit(joined);

    expect(order).toEqual(["fast"]);

    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(["fast", "deferred"]);
  });

  it("FAST wildcard handlers run synchronously", () => {
    const hub = new Hub();
    const events: string[] = [];

    hub.onAny(() => {
      events.push("fast-wild");
    }, FAST);
    hub.emit(joined);

    expect(events).toEqual(["fast-wild"]);
  });

  it("DEFERRED wildcard handlers run asynchronously", async () => {
    const hub = new Hub();
    const events: string[] = [];

    hub.onAny(() => {
      events.push("deferred-wild");
    }, DEFERRED);
    hub.emit(joined);

    expect(events).toEqual([]);

    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual(["deferred-wild"]);
  });

  it("typed FAST runs before wildcard FAST for the same emit", () => {
    const hub = new Hub();
    const order: string[] = [];

    hub.on(
      ROOM_JOINED,
      () => {
        order.push("typed");
      },
      FAST,
    );
    hub.onAny(() => {
      order.push("wild");
    }, FAST);

    hub.emit(joined);

    expect(order).toEqual(["typed", "wild"]);
  });

  it("on() defaults to DEFERRED priority", async () => {
    const hub = new Hub();
    const handler = mock(() => {});

    hub.on(ROOM_JOINED, handler);
    hub.emit(joined);

    expect(handler).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("onAny() defaults to DEFERRED priority", async () => {
    const hub = new Hub();
    const handler = mock(() => {});

    hub.onAny(handler);
    hub.emit(joined);

    expect(handler).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("typed FAST and wildcard FAST both complete before any DEFERRED handler", async () => {
    const hub = new Hub();
    const order: string[] = [];

    hub.on(
      ROOM_JOINED,
      () => {
        order.push("typed-fast");
      },
      FAST,
    );
    hub.onAny(() => {
      order.push("wild-fast");
    }, FAST);
    hub.on(
      ROOM_JOINED,
      () => {
        order.push("typed-deferred");
      },
      DEFERRED,
    );
    hub.onAny(() => {
      order.push("wild-deferred");
    }, DEFERRED);

    hub.emit(joined);

    expect(order).toEqual(["typed-fast", "wild-fast"]);

    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual([
      "typed-fast",
      "wild-fast",
      "typed-deferred",
      "wild-deferred",
    ]);
  });

  it("routes a synchronously thrown handler error to onError, without stopping other handlers", () => {
    const onError = mock(() => {});
    const hub = new Hub(onError);
    const boom = new Error("sync failure");

    const bad = mock(() => {
      throw boom;
    });
    const good = mock(() => {});

    hub.on(ROOM_JOINED, bad, FAST);
    hub.on(ROOM_JOINED, good, FAST);

    hub.emit(joined);

    expect(onError).toHaveBeenCalledWith(boom);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("routes a synchronously thrown wildcard error to onError, without stopping other wildcards", () => {
    const onError = mock(() => {});
    const hub = new Hub(onError);
    const boom = new Error("wild sync failure");

    const bad = mock(() => {
      throw boom;
    });
    const good = mock(() => {});

    hub.onAny(bad, FAST);
    hub.onAny(good, FAST);

    hub.emit(joined);

    expect(onError).toHaveBeenCalledWith(boom);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("routes a rejected async handler to onError", async () => {
    const onError = mock(() => {});
    const hub = new Hub(onError);
    const boom = new Error("async failure");

    hub.on(
      ROOM_JOINED,
      async () => {
        throw boom;
      },
      FAST,
    );

    hub.emit(joined);

    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("routes a DEFERRED handler sync throw to onError", async () => {
    const onError = mock(() => {});
    const hub = new Hub(onError);
    const boom = new Error("deferred sync failure");

    hub.on(
      ROOM_JOINED,
      () => {
        throw boom;
      },
      DEFERRED,
    );
    hub.emit(joined);

    await new Promise((r) => setTimeout(r, 0));

    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("defaults to console.error when no onError is provided", () => {
    const orig = console.error;
    const spy = mock(() => {});
    console.error = spy;

    try {
      const hub = new Hub();
      const boom = new Error("default handler failure");

      hub.on(
        ROOM_JOINED,
        () => {
          throw boom;
        },
        FAST,
      );
      hub.emit(joined);

      expect(spy).toHaveBeenCalledWith("[Hub]", boom);
    } finally {
      console.error = orig;
    }
  });

  it("default onError swallows async rejections too", async () => {
    const orig = console.error;
    const spy = mock(() => {});
    console.error = spy;

    try {
      const hub = new Hub();
      const boom = new Error("default async failure");

      hub.on(
        ROOM_JOINED,
        async () => {
          throw boom;
        },
        FAST,
      );
      hub.emit(joined);

      await Promise.resolve();
      await Promise.resolve();

      expect(spy).toHaveBeenCalledWith("[Hub]", boom);
    } finally {
      console.error = orig;
    }
  });

  it("keeps typed and wildcard handlers independent across multiple event types", () => {
    const hub = new Hub();
    const openedHandler = mock(() => {});
    const joinedHandler = mock(() => {});

    hub.on(CONNECTION_OPENED, openedHandler, FAST);
    hub.on(ROOM_JOINED, joinedHandler, FAST);

    hub.emit(joined);

    expect(joinedHandler).toHaveBeenCalledTimes(1);
    expect(openedHandler).not.toHaveBeenCalled();
  });

  it("console.error default does not throw when no handler registered", () => {
    const hub = new Hub();
    expect(() => hub.emit(joined)).not.toThrow();
  });
});
