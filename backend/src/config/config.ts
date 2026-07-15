const config = {
  port: Number(Bun.env.PORT ?? 3000),
  clientUrl: Bun.env.CLIENT_URL ?? "http://localhost:4000",
  nodeEnv: Bun.env.NODE_ENV ?? "development",
  logEnabled: (Bun.env.LOG_ENABLED ?? "true") !== "false",
  logLevel: Bun.env.LOG_LEVEL,
  logFormat: Bun.env.LOG_FORMAT,
  logExclude: Bun.env.LOG_EXCLUDE ?? "",
  logSample: Bun.env.LOG_SAMPLE ?? "",
  // Optional path to also persist logs to disk (ndjson), on top of
  // whatever goes to stdout/stderr. Unset = no file output.
  logFile: Bun.env.LOG_FILE,
} as const;

export default config;
