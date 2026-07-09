import type { Subscriber, Unsubscribe } from "../server/bus/bus";
import { DEFERRED } from "../server/bus/bus";
import type { Event } from "../server/protocol/events";
import type { LogSink, LogEntry } from "./sink";
import { ConsoleSink, FileSink, JsonSink, MultiSink, NullSink } from "./sink";
import type { LogConfig } from "./config";
import { loggingConfig } from "./config";

/**
 * Subscribes to every event on the Hub and writes each one to a LogSink.
 *
 * Always registers on the DEFERRED lane, explicitly. Logging is pure
 * observation — it must never be able to add latency to the FAST lane
 * that game rules and clocks depend on. Bus already runs deferred
 * handlers on their own macrotask, so a slow sink (e.g. disk I/O) only
 * ever delays itself, never the rest of the system.
 */
export class EventLog {
  private readonly sink: LogSink;
  private readonly config: LogConfig;
  private unsubscribe: Unsubscribe | null = null;

  constructor(config: LogConfig = loggingConfig, sink?: LogSink) {
    this.config = config;
    this.sink = sink ?? defaultSinkFor(config);
  }

  /** Start receiving events from `bus`. Safe to call once; call `stop()` before re-attaching. */
  start(bus: Subscriber): void {
    if (!this.config.enabled) return;
    this.unsubscribe = bus.onAny((roomId, event) => {
      this.handle(roomId, event);
    }, DEFERRED);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private handle(roomId: string | null, event: Event): void {
    const { type } = event;

    if (this.config.exclude.has(type)) return;

    const rate = this.config.sampleRates.get(type);
    if (rate !== undefined && rate < 1 && Math.random() >= rate) return;

    const entry: LogEntry = {
      time: Date.now(),
      roomId,
      type,
      event,
    };
    this.sink.write(entry);
  }
}

function defaultSinkFor(config: LogConfig): LogSink {
  if (!config.enabled) return new NullSink();
  const primary = config.format === "json" ? new JsonSink() : new ConsoleSink();
  // LOG_FILE mirrors everything the primary sink sees into a file too,
  // regardless of format — FileSink always writes full ndjson.
  return config.filePath
    ? new MultiSink([primary, new FileSink(config.filePath)])
    : primary;
}
