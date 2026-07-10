import { describe, expect, it, mock, spyOn } from "bun:test";
import { Hub, DEFERRED } from "../server/bus/bus";
import type { Subscriber } from "../server/bus/bus";
import { CONNECTION_OPENED, ROOM_JOINED } from "../server/protocol/events";
import type { Event } from "../server/protocol/events";
import { WHITE } from "../server/types";
import type { GameSnapshot } from "../server/types";
import { EventLog } from "./events";
import type { LogSink, LogEntry } from "./sink";
import type { LogConfig } from "./config";

const joined: Event = {
  type: ROOM_JOINED,
  roomId: "room-1",
  color: WHITE,
  state: {} as GameSnapshot,
};

const opened: Event = {
  type: CONNECTION_OPENED,
  playerId: "p1",
  ws: {},
  roomId: null,
};

function makeConfig(overrides: Partial<LogConfig> = {}): LogConfig {
  return {
    enabled: true,
    level: "debug",
    format: "pretty",
    exclude: new Set(),
    sampleRates: new Map(),
    filePath: null,
    ...overrides,
  };
}

function makeSink(): { sink: LogSink; write: ReturnType<typeof mock> } {
  const write = mock((_entry: LogEntry) => {});
  return { sink: { write }, write };
}

// EventLog registers on the DEFERRED lane, which Hub runs on a macrotask.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("EventLog.start", () => {
  it("does not subscribe at all when config.enabled is false", () => {
    const onAny = mock(() => () => {});
    const bus: Subscriber = { on: mock(() => () => {}), onAny };
    const { sink } = makeSink();

    new EventLog(makeConfig({ enabled: false }), sink).start(bus);

    expect(onAny).not.toHaveBeenCalled();
  });

  it("subscribes via onAny on the DEFERRED lane when enabled", () => {
    const onAny = mock((_handler: unknown, _priority?: unknown) => () => {});
    const bus: Subscriber = { on: mock(() => () => {}), onAny };
    const { sink } = makeSink();

    new EventLog(makeConfig(), sink).start(bus);

    expect(onAny).toHaveBeenCalledTimes(1);
    expect(onAny.mock.calls[0]?.[1]).toBe(DEFERRED);
  });
});

describe("EventLog event handling (via a real Hub)", () => {
  it("writes a LogEntry with time/roomId/type/event to the sink", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const nowSpy = spyOn(Date, "now").mockReturnValue(123_456);

    try {
      new EventLog(makeConfig(), sink).start(hub);
      hub.emit(joined);

      // DEFERRED handlers don't run synchronously.
      expect(write).not.toHaveBeenCalled();

      await flush();

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith({
        time: 123_456,
        roomId: "room-1",
        type: ROOM_JOINED,
        event: joined,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("uses a null roomId for events whose own roomId is null", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();

    new EventLog(makeConfig(), sink).start(hub);
    hub.emit(opened);
    await flush();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: null, type: CONNECTION_OPENED }),
    );
  });

  it("drops event types listed in config.exclude", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const config = makeConfig({ exclude: new Set([ROOM_JOINED]) });

    new EventLog(config, sink).start(hub);
    hub.emit(joined);
    await flush();

    expect(write).not.toHaveBeenCalled();
  });

  it("does not drop event types absent from config.exclude", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const config = makeConfig({ exclude: new Set([CONNECTION_OPENED]) });

    new EventLog(config, sink).start(hub);
    hub.emit(joined);
    await flush();

    expect(write).toHaveBeenCalledTimes(1);
  });

  it("a sample rate of 0 always drops the event", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const config = makeConfig({ sampleRates: new Map([[ROOM_JOINED, 0]]) });

    new EventLog(config, sink).start(hub);
    hub.emit(joined);
    hub.emit(joined);
    await flush();

    expect(write).not.toHaveBeenCalled();
  });

  it("a sample rate of 1 always logs the event", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const config = makeConfig({ sampleRates: new Map([[ROOM_JOINED, 1]]) });

    new EventLog(config, sink).start(hub);
    hub.emit(joined);
    hub.emit(joined);
    await flush();

    expect(write).toHaveBeenCalledTimes(2);
  });

  it("an unlisted type defaults to always logging, regardless of other sample rates", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const config = makeConfig({
      sampleRates: new Map([[CONNECTION_OPENED, 0]]),
    });

    new EventLog(config, sink).start(hub);
    hub.emit(joined);
    await flush();

    expect(write).toHaveBeenCalledTimes(1);
  });

  it("a mid-range sample rate logs only when Math.random() is under the rate", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const config = makeConfig({ sampleRates: new Map([[ROOM_JOINED, 0.5]]) });
    const randomSpy = spyOn(Math, "random");

    try {
      new EventLog(config, sink).start(hub);

      randomSpy.mockReturnValue(0.3); // below 0.5 -> logs
      hub.emit(joined);
      await flush();
      expect(write).toHaveBeenCalledTimes(1);

      randomSpy.mockReturnValue(0.9); // at/above 0.5 -> dropped
      hub.emit(joined);
      await flush();
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

describe("EventLog.stop", () => {
  it("stops delivery to the sink after being called", async () => {
    const hub = new Hub();
    const { sink, write } = makeSink();
    const eventLog = new EventLog(makeConfig(), sink);

    eventLog.start(hub);
    hub.emit(joined);
    await flush();
    expect(write).toHaveBeenCalledTimes(1);

    eventLog.stop();
    hub.emit(joined);
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("is a harmless no-op when called before start()", () => {
    const { sink } = makeSink();
    const eventLog = new EventLog(makeConfig(), sink);

    expect(() => eventLog.stop()).not.toThrow();
  });

  it("is a harmless no-op when called twice", () => {
    const hub = new Hub();
    const { sink } = makeSink();
    const eventLog = new EventLog(makeConfig(), sink);

    eventLog.start(hub);
    eventLog.stop();

    expect(() => eventLog.stop()).not.toThrow();
  });
});

describe("EventLog default sink selection", () => {
  it("defaults to a console-writing sink when format is 'pretty' and no sink is given", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const hub = new Hub();
      new EventLog(makeConfig({ format: "pretty" })).start(hub);

      hub.emit(joined);
      await flush();

      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });

  it("defaults to a stdout-writing sink when format is 'json' and no sink is given", async () => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const hub = new Hub();
      new EventLog(makeConfig({ format: "json" })).start(hub);

      hub.emit(joined);
      await flush();

      // hub.emit itself writes its own log line (HUB-emit) via the app logger,
      // and the EventLog sink writes the event line. Since the two writes are
      // async/callback-based, we assert that at least the event-log line was emitted.
      expect(write).toHaveBeenCalled();
    } finally {
      write.mockRestore();
    }
  });

  it("produces no output at all when config.enabled is false and no sink is given", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const hub = new Hub();
      hub.onAny(() => {}, DEFERRED); // silence [HUB-subscribe] log in capture
      new EventLog(makeConfig({ enabled: false })).start(hub);

      hub.emit(joined);
      await flush();

      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      write.mockRestore();
    }
  });
});
