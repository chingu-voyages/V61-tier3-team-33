import { describe, expect, it, spyOn } from "bun:test";
import type { LogEntry, LogSink } from "./log-sink";
import { ConsoleSink, JsonSink, MultiSink, NullSink } from "./log-sink";
import { dim, paint, timestamp, truncate } from "./format";
import { CONNECTION_OPENED, ROOM_JOINED } from "../server/protocol/events";
import type { Event } from "../server/protocol/events";
import { WHITE } from "../server/domain/types";
import type { GameSnapshot } from "../server/domain/types";

// Mirrors FAMILY_COLOR in log-sink.ts — kept here as plain literals since
// the table itself isn't exported.
const ROOM_COLOR = "\x1b[32m"; // green
const CONNECTION_COLOR = "\x1b[35m"; // magenta
const MAX_INLINE_PAYLOAD = 300; // mirrors log-sink.ts

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

function entryFor(event: Event, roomId: string | null, time = 0): LogEntry {
  return { time, roomId, type: event.type, event };
}

describe("ConsoleSink", () => {
  it("logs one formatted line with timestamp, colored type, room, and payload", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const entry = entryFor(joined, "room-1", 1_000);
      new ConsoleSink().write(entry);

      const expected = `${dim(timestamp(1_000))} ${paint(ROOM_COLOR, "room:joined".padEnd(18))} ${dim("[room-1]")} ${truncate(JSON.stringify(joined), MAX_INLINE_PAYLOAD)}`;

      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(expected);
    } finally {
      log.mockRestore();
    }
  });

  it("renders '[-]' when roomId is null", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const entry = entryFor(opened, null, 2_000);
      new ConsoleSink().write(entry);

      const expected = `${dim(timestamp(2_000))} ${paint(CONNECTION_COLOR, "connection:opened".padEnd(18))} ${dim("[-]")} ${truncate(JSON.stringify(opened), MAX_INLINE_PAYLOAD)}`;

      expect(log).toHaveBeenCalledWith(expected);
    } finally {
      log.mockRestore();
    }
  });

  it("truncates a payload larger than MAX_INLINE_PAYLOAD chars", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const bigState = { blob: "x".repeat(1000) } as unknown as GameSnapshot;
      const bigJoined: Event = {
        type: ROOM_JOINED,
        roomId: "room-1",
        color: WHITE,
        state: bigState,
      };
      const entry = entryFor(bigJoined, "room-1", 3_000);
      new ConsoleSink().write(entry);

      const [line] = log.mock.calls[0] as [string];
      expect(line).toContain("…(+");
      expect(line.length).toBeLessThan(JSON.stringify(bigJoined).length);
    } finally {
      log.mockRestore();
    }
  });

  it("does not truncate a payload at or under MAX_INLINE_PAYLOAD chars", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const entry = entryFor(opened, null, 4_000);
      new ConsoleSink().write(entry);

      const [line] = log.mock.calls[0] as [string];
      expect(line).not.toContain("…(+");
    } finally {
      log.mockRestore();
    }
  });
});

describe("JsonSink", () => {
  it("writes one ndjson line to process.stdout containing the full entry", () => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const entry = entryFor(opened, null, 5_000);
      new JsonSink().write(entry);

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(JSON.stringify(entry) + "\n");
    } finally {
      write.mockRestore();
    }
  });

  it("does not truncate large payloads (unlike ConsoleSink)", () => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const bigState = { blob: "x".repeat(1000) } as unknown as GameSnapshot;
      const bigJoined: Event = {
        type: ROOM_JOINED,
        roomId: "room-1",
        color: WHITE,
        state: bigState,
      };
      const entry = entryFor(bigJoined, "room-1", 6_000);
      new JsonSink().write(entry);

      expect(write).toHaveBeenCalledWith(JSON.stringify(entry) + "\n");
    } finally {
      write.mockRestore();
    }
  });
});

describe("NullSink", () => {
  it("discards the entry without throwing or logging anything", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    const write = spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const sink: LogSink = new NullSink();
      expect(() => sink.write(entryFor(opened, null))).not.toThrow();
      expect(log).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      write.mockRestore();
    }
  });

  it("write() returns undefined", () => {
    const sink: LogSink = new NullSink();
    expect(sink.write(entryFor(opened, null))).toBeUndefined();
  });
});

describe("MultiSink", () => {
  it("fans out a single write to every wrapped sink, unmodified", () => {
    const a: LogSink = { write: () => {} };
    const b: LogSink = { write: () => {} };
    const aWrite = spyOn(a, "write");
    const bWrite = spyOn(b, "write");
    const entry = entryFor(opened, null, 7_000);

    new MultiSink([a, b]).write(entry);

    expect(aWrite).toHaveBeenCalledTimes(1);
    expect(aWrite).toHaveBeenCalledWith(entry);
    expect(bWrite).toHaveBeenCalledTimes(1);
    expect(bWrite).toHaveBeenCalledWith(entry);
  });

  it("does nothing when given an empty list of sinks", () => {
    expect(() => new MultiSink([]).write(entryFor(opened, null))).not.toThrow();
  });

  it("calls sinks in the order they were provided", () => {
    const order: string[] = [];
    const a: LogSink = { write: () => order.push("a") };
    const b: LogSink = { write: () => order.push("b") };

    new MultiSink([a, b]).write(entryFor(opened, null));

    expect(order).toEqual(["a", "b"]);
  });
});
