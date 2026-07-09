import type { LogConfig, LogLevel } from "./config";
import { loggingConfig } from "./config";
import { createFileWriter, dim, paint, timestamp, truncate, writeJsonLine } from "./format";
import type { LineWriter } from "./format";

export interface LogFields {
  [key: string]: unknown;
}

/**
 * General-purpose app logger — for anything that isn't a bus Event
 * (startup, retries, connection lifecycle, caught errors). Complements
 * EventLog rather than replacing it: this narrates what the *server*
 * is doing, EventLog narrates what the *game* is doing.
 */
export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Returns a logger that merges `context` into every call's fields — use for per-module tags instead of repeating them at every call site. */
  child(context: LogFields): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};

// Same rationale as ConsoleSink's payload cap in log-sink.ts: keep one
// log call's fields from spilling a huge object across the terminal.
// json format is unaffected — it always gets the full object.
const MAX_INLINE_FIELDS = 300;

class AppLogger implements Logger {
  constructor(
    private readonly config: LogConfig,
    private readonly context: LogFields = {},
    // Shared across a logger and all of its .child()ren so LOG_FILE opens
    // the file once per process, not once per child logger.
    private readonly fileWriter: LineWriter | null = config.filePath
      ? createFileWriter(config.filePath)
      : null,
  ) {}

  debug(msg: string, fields?: LogFields): void {
    this.log("debug", msg, fields);
  }
  info(msg: string, fields?: LogFields): void {
    this.log("info", msg, fields);
  }
  warn(msg: string, fields?: LogFields): void {
    this.log("warn", msg, fields);
  }
  error(msg: string, fields?: LogFields): void {
    this.log("error", msg, fields);
  }

  child(context: LogFields): Logger {
    return new AppLogger(
      this.config,
      { ...this.context, ...context },
      this.fileWriter,
    );
  }

  private log(level: LogLevel, msg: string, fields?: LogFields): void {
    if (!this.config.enabled) return;
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.config.level]) return;

    const merged = fields ? { ...this.context, ...fields } : this.context;
    const time = Date.now();
    const stream = level === "error" ? process.stderr : process.stdout;

    if (this.config.format === "json") {
      const data = { time, level, msg, ...merged };
      writeJsonLine(stream, data);
      this.fileWriter?.write(JSON.stringify(data) + "\n");
      return;
    }

    const fieldStr = Object.keys(merged).length
      ? ` ${dim(truncate(JSON.stringify(merged), MAX_INLINE_FIELDS))}`
      : "";
    const levelStr = paint(LEVEL_COLOR[level], level.toUpperCase().padEnd(5));
    stream.write(`${dim(timestamp(time))} ${levelStr} ${msg}${fieldStr}\n`);

    // The file always gets plain ndjson — color codes and inline
    // truncation are terminal-readability concerns, not something a log
    // file (grepped, tailed, shipped) should carry.
    this.fileWriter?.write(JSON.stringify({ time, level, msg, ...merged }) + "\n");
  }
}

/** Root logger. Prefer `logger.child({ module: "X" })` per-module over using this directly, so every line is traceable to its source. */
export const logger: Logger = new AppLogger(loggingConfig);
