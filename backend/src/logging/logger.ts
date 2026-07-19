import { DEBUG, ERROR, INFO, JSON_FORMAT, type LogConfig, loggingConfig, type LogLevel, WARN } from "./config";
import type { LineWriter } from "./format";
import { Format } from "./format";

const MAX_INLINE_FIELDS = 300;

export interface LogFields {
  [key: string]: unknown;
}

/** App logger — narrates server internals (startup, retries, lifecycle). Complements EventLog (game events). */
export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Returns a logger that merges `context` into every call's fields. */
  child(context: LogFields): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  [DEBUG]: 0,
  [INFO]: 1,
  [WARN]: 2,
  [ERROR]: 3,
};

class AppLogger implements Logger {
  constructor(
    private readonly config: LogConfig,
    private readonly context: LogFields = {},
    // shared across child loggers — file opens once per process
    private readonly fileWriter: LineWriter | null = config.filePath ? Format.createFileWriter(config.filePath) : null,
  ) {}

  debug(msg: string, fields?: LogFields): void {
    this.log(DEBUG, msg, fields);
  }
  info(msg: string, fields?: LogFields): void {
    this.log(INFO, msg, fields);
  }
  warn(msg: string, fields?: LogFields): void {
    this.log(WARN, msg, fields);
  }
  error(msg: string, fields?: LogFields): void {
    this.log(ERROR, msg, fields);
  }

  child(context: LogFields): Logger {
    return new AppLogger(this.config, { ...this.context, ...context }, this.fileWriter);
  }

  private log(level: LogLevel, msg: string, fields?: LogFields): void {
    if (!this.config.enabled) return;
    const levelOrderLevel = LEVEL_ORDER[level];
    const levelOrderConfig = LEVEL_ORDER[this.config.level];
    if (levelOrderLevel === undefined || levelOrderConfig === undefined) return;
    if (levelOrderLevel < levelOrderConfig) return;

    const merged = fields ? { ...this.context, ...fields } : this.context;
    const time = Date.now();
    const stream = level === ERROR ? process.stderr : process.stdout;

    if (this.config.format === JSON_FORMAT) {
      const data = { time, level, msg, ...merged };
      Format(stream, data);
      this.fileWriter?.write(JSON.stringify(data) + "\n");
      return;
    }

    const fieldStr = Object.keys(merged).length
      ? ` ${Format.dim(Format.truncate(JSON.stringify(merged) ?? "", MAX_INLINE_FIELDS))}`
      : "";
    const levelStr = Format.paint(Format.LEVEL_COLOR[level] ?? "\x1b[0m", level.toUpperCase().padEnd(5));
    stream.write(`${Format.dim(Format.timestamp(time))} ${levelStr} ${msg}${fieldStr}\n`);

    // file always gets ndjson (no color codes/truncation)
    this.fileWriter?.write(JSON.stringify({ time, level, msg, ...merged }) + "\n");
  }
}

/** Root logger. Prefer `logger.child({ module: "X" })` per-module. */
export const logger: Logger = new AppLogger(loggingConfig);
