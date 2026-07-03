import type { Event } from "../server/protocol/events";
import { createFileWriter, dim, paint, timestamp, truncate, writeJsonLine } from "./format";
import type { LineWriter } from "./format";

/** One logged occurrence of a bus Event. */
export interface LogEntry {
  readonly time: number;
  readonly roomId: string | null;
  readonly type: Event["type"];
  readonly event: Event;
}

/** Where log entries go. Swappable so a real sink (file, remote) can replace ConsoleSink later without touching EventLogger. */
export interface LogSink {
  write(entry: LogEntry): void;
}

// The part of an event type before the ":" (e.g. "move:made" -> "move").
// Derived from Event itself instead of hand-listed, so adding a new
// family in protocol/events.ts is a type error right here until
// FAMILY_COLOR below is given a color for it — it can't go unnoticed.
type FamilyOf<T extends string> = T extends `${infer Family}:${string}`
  ? Family
  : never;
type EventFamily = FamilyOf<Event["type"]>;

// Color per event family, so a scrolling log is scannable at a glance.
// Record (not Partial) means every family is required to have a color —
// TypeScript, not a runtime fallback, catches a missing one.
const FAMILY_COLOR: Record<EventFamily, string> = {
  move: "\x1b[36m", // cyan
  undo: "\x1b[34m", // blue
  position: "\x1b[37m", // white
  game: "\x1b[32m", // green
  room: "\x1b[32m", // green
  clock: "\x1b[33m", // yellow
  grace: "\x1b[33m", // yellow
  connection: "\x1b[35m", // magenta
};

// Caps the inline JSON payload in ConsoleSink so one large event (e.g. a
// full board snapshot on room:joined) can't turn a scannable log into a
// wall of text. JsonSink always gets the untruncated event.
const MAX_INLINE_PAYLOAD = 300;

function familyOf(type: Event["type"]): EventFamily {
  return (type.split(":")[0] ?? type) as EventFamily;
}

/**
 * Dev sink: human-readable single line, color-coded by event family,
 * payload capped at MAX_INLINE_PAYLOAD chars. Optimized for readability,
 * not throughput — never use this in production, `JSON.stringify`-per-write
 * plus color codes cost real CPU under load.
 */
export class ConsoleSink implements LogSink {
  write(entry: LogEntry): void {
    const room = entry.roomId ? `[${entry.roomId}]` : "[-]";
    const color = FAMILY_COLOR[familyOf(entry.type)];
    const payload = truncate(JSON.stringify(entry.event), MAX_INLINE_PAYLOAD);

    console.log(
      `${dim(timestamp(entry.time))} ${paint(color, entry.type.padEnd(18))} ${dim(room)} ${payload}`,
    );
  }
}

/**
 * Prod sink: ndjson to stdout — just the fields a log aggregator
 * (CloudWatch, Loki) needs, no color codes or padding.
 */
export class JsonSink implements LogSink {
  write(entry: LogEntry): void {
    writeJsonLine(process.stdout, entry);
  }
}

/**
 * Persists ndjson lines to a file on disk. Always full, untruncated JSON —
 * same rationale as JsonSink: a file is for machines (grep, log shippers,
 * `tail -f`), not for eyeballs, so there's no color/truncation to strip.
 * Opens the file once per instance and keeps it open for the sink's
 * lifetime; construct one FileSink per path, not per write.
 */
export class FileSink implements LogSink {
  private readonly file: LineWriter;

  constructor(path: string) {
    this.file = createFileWriter(path);
  }

  write(entry: LogEntry): void {
    this.file.write(JSON.stringify(entry) + "\n");
  }
}

/** Discards everything. Useful for tests and for fully disabling logging. */
export class NullSink implements LogSink {
  write(): void {}
}

/** Fans out to multiple sinks (e.g. console + file) without EventLogger knowing. */
export class MultiSink implements LogSink {
  constructor(private readonly sinks: readonly LogSink[]) {}
  write(entry: LogEntry): void {
    for (const sink of this.sinks) sink.write(entry);
  }
}
