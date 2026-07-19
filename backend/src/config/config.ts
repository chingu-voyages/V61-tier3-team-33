const config = {
  port: Number(Bun.env.PORT ?? 3000),
  storeKind: (Bun.env.STORE_KIND ?? "memory") as "memory" | "postgres",

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

  // Postgres connection
  pgHost: Bun.env.PG_HOST ?? "localhost",
  pgPort: Number(Bun.env.PG_PORT ?? 5432),
  pgDatabase: Bun.env.PG_DATABASE,
  pgTestDatabase: Bun.env.TEST_DATABASE,
  pgUser: Bun.env.PG_USER ?? "postgres",
  pgPassword: Bun.env.PG_PASSWORD,
  pgPoolMax: Number(Bun.env.PG_POOL_MAX ?? 10),
  pgIdleTimeout: Number(Bun.env.PG_IDLE_TIMEOUT ?? 30),
  pgConnectTimeout: Number(Bun.env.PG_CONNECT_TIMEOUT ?? 10),
  pgTls: (Bun.env.PG_TLS ?? "false") === "true",
  pgMaxLifetime: Number(Bun.env.PG_MAX_LIFETIME ?? 1800),

  googleClientId: Bun.env.GOOGLE_CLIENT_ID,
} as const;

export default config;
