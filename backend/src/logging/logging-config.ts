// Logging configuration, read once from env at boot — nothing here is
// re-read per event/log call, that's on the hot path.

import config from "../config/config";
import type { Event } from "../server/protocol/events";
import { CLOCK_TICK } from "../server/protocol/events";

export type LogFormat = "pretty" | "json";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggingConfig {
  // Master on/off switch.
  readonly enabled: boolean;
  // Minimum level a Logger call must meet to reach a sink. EventLogger
  // ignores this — bus events aren't leveled, see exclude/sampleRates.
  readonly level: LogLevel;
  // "pretty" (colored, human) in dev; "json" (ndjson to stdout) in prod.
  readonly format: LogFormat;
  // Event types dropped before they reach a sink. CLOCK_TICK fires every
  // ~250ms per active game and drowns everything else out, so it's
  // excluded by default in prod. Override with LOG_EXCLUDE.
  readonly exclude: ReadonlySet<Event["type"]>;
  // Per-type sampling rate in [0, 1], for types you want partial rather
  // than zero visibility into. Unlisted types default to 1 (log every
  // occurrence). Set with LOG_SAMPLE=type=rate,type=rate.
  readonly sampleRates: ReadonlyMap<Event["type"], number>;
  // Optional path to also persist logs to disk (ndjson), alongside
  // whatever goes to stdout/stderr. null = no file output. Set with
  // LOG_FILE=/path/to/file.log.
  readonly filePath: string | null;
}

const nodeEnv = config.nodeEnv;
const isProd = nodeEnv === "production";

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// LOG_EXCLUDE / LOG_SAMPLE are env vars — untyped input by nature. The
// casts to Event["type"] happen right here, at the point each one is
// parsed, so every other file that reads LoggingConfig gets to trust
// the type instead of re-checking it.
function parseSampleRates(raw: string | undefined): Map<Event["type"], number> {
  const rates = new Map<Event["type"], number>();
  for (const entry of parseList(raw)) {
    const [type, rate] = entry.split("=");
    if (!type) continue;
    // No "=value" (or an empty one) means "log every occurrence"; an
    // unparseable value falls back to that same default instead of
    // silently becoming NaN, which event-logger.ts's `rate < 1` check
    // would just as silently treat as "always log".
    const parsed = rate ? Number(rate) : 1;
    rates.set(type as Event["type"], Number.isNaN(parsed) ? 1 : parsed);
  }
  return rates;
}

const DEFAULT_EXCLUDE: Event["type"][] = isProd ? [CLOCK_TICK] : [];

// "" (unset, via config's `?? ""` elsewhere) and whitespace-only both mean
// "no file logging" — trimmed here so `LOG_FILE=` in a .env doesn't
// silently try to open a file named "".
function parseFilePath(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const loggingConfig: LoggingConfig = {
  enabled: config.logEnabled,
  level: (config.logLevel as LogLevel) ?? (isProd ? "info" : "debug"),
  format: (config.logFormat as LogFormat) ?? (isProd ? "json" : "pretty"),
  exclude: new Set([
    ...DEFAULT_EXCLUDE,
    ...(parseList(config.logExclude) as Event["type"][]),
  ]),
  sampleRates: parseSampleRates(config.logSample),
  filePath: parseFilePath(config.logFile),
} as const;
