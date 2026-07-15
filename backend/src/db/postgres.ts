import { SQL } from "bun";

import config from "../config/config";
import { logger as rootLogger } from "../logging/logger";

const log = rootLogger.child({ module: "Postgres" });

export const sql = new SQL({
  // Connection
  hostname: config.pgHost,
  port: config.pgPort,
  database: config.pgDatabase,
  username: config.pgUser,
  password: config.pgPassword,

  // Pool
  max: config.pgPoolMax,
  idleTimeout: config.pgIdleTimeout,
  maxLifetime: config.pgMaxLifetime,
  connectionTimeout: config.pgConnectTimeout,

  // TLS
  tls: config.pgTls,

  // Lifecycle
  onconnect: () => {
    log.info("[Postgres.connected:open]", { host: config.pgHost, port: config.pgPort, database: config.pgDatabase });
  },
  onclose: () => {
    log.info("[Postgres.connected:closed]", { host: config.pgHost, port: config.pgPort, database: config.pgDatabase });
  },
});

export default sql;
