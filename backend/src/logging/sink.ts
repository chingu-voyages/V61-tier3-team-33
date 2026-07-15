import type { Event } from "../server/protocol/events";
import type { LineWriter } from "./format";
import { Format } from "./format";

const MAX_INLINE_PAYLOAD = 300;

/** One logged occurrence of a bus Event. */
export interface LogEntry {
  readonly time: number;
  readonly roomId: string | null;
  readonly type: Event["type"];
  readonly event: Event;
}

/** Where log entries go. Swappable so a prod sink can replace ConsoleSink later. */
export interface LogSink {
  write(entry: LogEntry): void;
}

/** Dev sink: single-line, color-coded, payload capped. Not for prod (CPU cost). */
export class ConsoleSink implements LogSink {
  write(entry: LogEntry): void {
    const room = entry.roomId ? `[${entry.roomId}]` : "[-]";
    const color = Format.FAMILY_COLOR[Format.familyOf(entry.type)];
    const payload = Format.truncate(JSON.stringify(entry.event), MAX_INLINE_PAYLOAD);

    console.log(
      `${Format.dim(Format.timestamp(entry.time))} ${Format.paint(color, entry.type.padEnd(18))} ${Format.dim(room)} ${payload}`,
    );
  }
}

/** Prod sink: ndjson to stdout. */
export class JsonSink implements LogSink {
  write(entry: LogEntry): void {
    Format(process.stdout, entry);
  }
}

/** Persists ndjson to a file on disk. Opens once per instance. */
export class FileSink implements LogSink {
  private readonly file: LineWriter;

  constructor(path: string) {
    this.file = Format.createFileWriter(path);
  }

  write(entry: LogEntry): void {
    this.file.write(JSON.stringify(entry) + "\n");
  }
}

/** Discards everything. Useful for tests and disabling logging. */
export class NullSink implements LogSink {
  write(): void {}
}

/** Fans out to multiple sinks. */
export class MultiSink implements LogSink {
  constructor(private readonly sinks: readonly LogSink[]) {}
  write(entry: LogEntry): void {
    for (const sink of this.sinks) sink.write(entry);
  }
}
