import { openSync, writeSync } from "node:fs";

import type { Event } from "../server/protocol/events";
import type { LogLevel } from "./config";
import { DEBUG, ERROR, INFO, WARN } from "./config";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

// Event family derived from type prefix (e.g. "move:made" → "move").
// Record forces every family to have a color — compile error on new event type.
type FamilyOf<T extends string> = T extends `${infer Family}:${string}` ? Family : never;
export type EventFamily = FamilyOf<Event["type"]>;

/** Pre-formatted-string writer (not LogEntry-based like LogSink). */
export interface LineWriter {
  write(line: string): void;
}

export const Format = Object.assign(
  (stream: NodeJS.WritableStream, data: object): void => {
    stream.write(JSON.stringify(data) + "\n");
  },
  {
    dim: (text: string): string => `${DIM}${text}${RESET}`,

    paint: (color: string, text: string): string => `${color}${text}${RESET}`,

    FAMILY_COLOR: {
      move: "\x1b[36m",
      undo: "\x1b[34m",
      position: "\x1b[37m",
      game: "\x1b[32m",
      room: "\x1b[32m",
      clock: "\x1b[33m",
      grace: "\x1b[33m",
      connection: "\x1b[35m",
      emote: "\x1b[95m",
    } as Record<EventFamily, string>,

    LEVEL_COLOR: {
      [DEBUG]: "\x1b[90m",
      [INFO]: "\x1b[32m",
      [WARN]: "\x1b[33m",
      [ERROR]: "\x1b[31m",
    } as Record<LogLevel, string>,

    familyOf: (type: Event["type"]): EventFamily => (type.split(":")[0] ?? type) as EventFamily,

    timestamp: (time: number = Date.now()): string => new Date(time).toISOString().slice(11, 23),

    truncate(text: string, max: number): string {
      if (text.length <= max) return text;
      return `${text.slice(0, max)}…(+${text.length - max}c)`;
    },

    createFileWriter(path: string): LineWriter {
      const fd = openSync(path, "a");
      return {
        write(line: string): void {
          writeSync(fd, line);
        },
      };
    },
  },
);
