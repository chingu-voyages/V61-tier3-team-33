import { openSync, writeSync } from "node:fs";

// Shared low-level formatting used by both ConsoleSink (events) and
// Logger (app logs), so color codes/timestamps/JSON writing exist once.

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export const dim = (text: string): string => `${DIM}${text}${RESET}`;
export const paint = (color: string, text: string): string =>
  `${color}${text}${RESET}`;

// HH:MM:SS.mmm — enough precision to see event ordering, short enough for one line.
export const timestamp = (time: number = Date.now()): string =>
  new Date(time).toISOString().slice(11, 23);

// Caps a string at `max` chars so one bulky payload (a full board
// snapshot, a long field list) can't push a human-facing log line past
// one screen width. Appends a char count instead of silently dropping
// data, so it's obvious something was cut — the json sink still gets
// the untruncated value.
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…(+${text.length - max}c)`;
}

// One JSON object per line (ndjson) — the format most log pipelines expect.
export function writeJsonLine(
  stream: NodeJS.WritableStream,
  data: object,
): void {
  stream.write(JSON.stringify(data) + "\n");
}

// Minimal line-writer contract for anything that persists log lines
// somewhere other than a stream (currently just FileSink and Logger's
// optional file mirror). Kept separate from LogSink since it deals in
// pre-formatted strings, not LogEntry objects.
export interface LineWriter {
  write(line: string): void;
}

// Opens `path` in append mode and returns a writer that flushes after
// every write. One instance per path — callers should create this once
// and reuse it rather than reopening the file on every log call.
//
// Bun.file(path).writer() is NOT used here: despite its name it opens the
// file for writing from scratch (no append flag), so it truncates any
// existing content on every FileSink construction — e.g. on every process
// restart, wiping prior log history. We open the fd explicitly with the
// "a" flag via node:fs instead, and write with writeSync so each write is
// both appended and flushed immediately (same crash-safety rationale as
// before: a crash shouldn't lose the last few lines).
export function createFileWriter(path: string): LineWriter {
  const fd = openSync(path, "a");
  return {
    write(line: string): void {
      writeSync(fd, line);
    },
  };
}
