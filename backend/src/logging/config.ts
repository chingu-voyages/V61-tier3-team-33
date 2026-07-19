import type { Brand } from "../chess/core/brand";
import appConfig from "../config/config";
import type { Event } from "../server/protocol/events";

export type LogFormat = Brand<string, "LogFormat">;
export const LogFormat = (value: string): LogFormat => value as LogFormat;

export type LogLevel = Brand<string, "LogLevel">;
export const LogLevel = (value: string): LogLevel => value as LogLevel;

export const DEBUG = LogLevel("debug");
export const INFO = LogLevel("info");
export const WARN = LogLevel("warn");
export const ERROR = LogLevel("error");

export const JSON_FORMAT = LogFormat("json");
export const PRETTY_FORMAT = LogFormat("pretty");

export type LogConfig = {
  readonly enabled: boolean;
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly exclude: ReadonlySet<Event["type"]>;
  readonly sampleRates: ReadonlyMap<Event["type"], number>;
  readonly filePath: string | null;
};

export const LogConfig = {
  fromEnv(): LogConfig {
    const isProd = appConfig.nodeEnv === "production";

    function parseList(raw: string | undefined): string[] {
      return (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    function parseSampleRates(raw: string | undefined): Map<Event["type"], number> {
      const rates = new Map<Event["type"], number>();
      for (const entry of parseList(raw)) {
        const [type, rate] = entry.split("=");
        if (!type) continue;
        const parsed = rate ? Number(rate) : 1;
        rates.set(type as Event["type"], Number.isNaN(parsed) ? 1 : parsed);
      }
      return rates;
    }

    function parseFilePath(raw: string | undefined): string | null {
      const trimmed = (raw ?? "").trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return {
      enabled: appConfig.logEnabled,
      level: (appConfig.logLevel as LogLevel) ?? (isProd ? INFO : DEBUG),
      format: (appConfig.logFormat as LogFormat) ?? (isProd ? JSON_FORMAT : PRETTY_FORMAT),
      exclude: new Set(parseList(appConfig.logExclude) as Event["type"][]),
      sampleRates: parseSampleRates(appConfig.logSample),
      filePath: parseFilePath(appConfig.logFile),
    };
  },
};

export const loggingConfig: LogConfig = LogConfig.fromEnv();
