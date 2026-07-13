import type { Subscriber, Unsubscribe } from "../server/bus/bus";
import type { Event } from "../server/protocol/events";
import { DEFERRED } from "../server/types/priority";
import type { LogConfig } from "./config";
import { JSON_FORMAT, loggingConfig } from "./config";
import type { LogEntry, LogSink } from "./sink";
import { ConsoleSink, FileSink, JsonSink, MultiSink, NullSink } from "./sink";

/**
 * Subscribes to all Hub events and writes each to a LogSink.
 * Always uses DEFERRED lane — logging must never add latency to FAST handlers.
 */
export class EventLog {
  private readonly sink: LogSink;
  private readonly config: LogConfig;
  private unsubscribe: Unsubscribe | null = null;

  constructor(config: LogConfig = loggingConfig, sink?: LogSink) {
    this.config = config;
    this.sink = sink ?? defaultSinkFor(config);
  }

  /** Start receiving events from `bus`. Call `stop()` before re-attaching. */
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
  const primary = config.format === JSON_FORMAT ? new JsonSink() : new ConsoleSink();
  return config.filePath ? new MultiSink([primary, new FileSink(config.filePath)]) : primary;
}
