import { SQL } from "bun";

import config from "../config/config";
import { logger as rootLogger } from "../logging/logger";

const log = rootLogger.child({ module: "Postgres" });

const isTest = Bun.env.NODE_ENV === "test";
// Bun's test runner sets NODE_ENV=test automatically (bun test), so this
// correctly targets the test database whenever tests are running, without
// requiring a separate env var that nothing actually sets.
const database = isTest ? (config.pgTestDatabase ?? config.pgDatabase) : config.pgDatabase;

export const sql = new SQL({
  hostname: config.pgHost,
  port: config.pgPort,
  database,
  username: config.pgUser,
  password: config.pgPassword,

  max: config.pgPoolMax,
  idleTimeout: config.pgIdleTimeout,
  maxLifetime: config.pgMaxLifetime,
  connectionTimeout: config.pgConnectTimeout,

  tls: config.pgTls,

  onconnect: () => {
    log.info("[Postgres.connected:open]", { host: config.pgHost, port: config.pgPort, database });
  },
  onclose: () => {
    log.info("[Postgres.connected:closed]", { host: config.pgHost, port: config.pgPort, database });
  },
});

export default sql;
