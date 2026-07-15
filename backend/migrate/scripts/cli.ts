import { sql } from "../../src/db/postgres";
import { logger as rootLogger } from "../../src/logging/logger";
import { runMigrations } from "./runner";

const log = rootLogger.child({ module: "Migrate" });

const direction = Bun.argv.includes("--down") ? "down" : "up";
const sqlDir = `${import.meta.dir}/../sql`;

log.info("[Migrate.cli:start]", { direction, sqlDir });

try {
  const { total } = await runMigrations(sqlDir, direction, (text) => sql.unsafe(text));
  log.info("[Migrate.cli:done]", { direction, total });
} catch (err) {
  log.error("[Migrate.cli:failed]", { error: (err as Error).message });
  process.exit(1);
} finally {
  await sql.close();
}
