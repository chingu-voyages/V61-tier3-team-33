import { sql } from "../../../db/postgres";
import { logger as rootLogger } from "../../../logging/logger";
import type { Result } from "../../types/result";
import type { PlayerError } from "../../types/result";
import { err, INTERNAL_ERROR, ok } from "../../types/result";
import { PLAYER_NOT_FOUND, USERNAME_TAKEN } from "../../types/result";
import { Player, type PlayerRow } from "./player";
import { GUEST } from "./player";
import type { PlayerStore } from "./player-store";

const log = rootLogger.child({ module: "PostgresPlayers" });

export class PostgresPlayers implements PlayerStore {
  async findById(id: string): Promise<Result<Player, PlayerError>> {
    const [row] = await sql<PlayerRow[]>`
      SELECT pid, username, role, provider, created_at
      FROM players
      WHERE pid = ${id}
    `;
    if (!row) {
      log.warn("[PostgresPlayers.findById:not-found]", { id });
      return err(PLAYER_NOT_FOUND);
    }
    return ok(Player.fromRow(row));
  }

  async findByUsername(username: string): Promise<Result<Player, PlayerError>> {
    const [row] = await sql<PlayerRow[]>`
      SELECT pid, username, role, provider, created_at
      FROM players
      WHERE LOWER(username) = LOWER(${username})
    `;
    if (!row) {
      log.warn("[PostgresPlayers.findByUsername:not-found]", { username });
      return err(PLAYER_NOT_FOUND);
    }
    return ok(Player.fromRow(row));
  }

  async save(player: Player): Promise<Result<void, PlayerError>> {
    try {
      if (player.provider !== GUEST) {
        const [existing] = await sql<{ pid: string }[]>`
          SELECT pid FROM players
          WHERE LOWER(username) = LOWER(${player.username})
            AND pid <> ${player.pid}
        `;
        if (existing) {
          log.warn("[PostgresPlayers.save:username-taken]", { pid: player.pid, username: player.username });
          return err(USERNAME_TAKEN);
        }
      }

      await sql`
        INSERT INTO players (pid, username, role, provider, created_at)
        VALUES (
          ${player.pid},
          ${player.username},
          ${player.role}::player_role,
          ${player.provider}::auth_provider,
          to_timestamp(${player.createdAt} / 1000.0)
        )
        ON CONFLICT (pid) DO UPDATE SET
          username = EXCLUDED.username,
          role = EXCLUDED.role,
          provider = EXCLUDED.provider
      `;
      log.info("[PostgresPlayers.save:saved]", { pid: player.pid, username: player.username });
      return ok();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresPlayers.save:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }

  async delete(pid: string): Promise<Result<void, PlayerError>> {
    try {
      const result = await sql`
        DELETE FROM players WHERE pid = ${pid}
      `;
      if (result.count === 0) {
        log.warn("[PostgresPlayers.delete:not-found]", { pid });
        return err(PLAYER_NOT_FOUND);
      }
      log.info("[PostgresPlayers.delete:deleted]", { pid });
      return ok();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresPlayers.delete:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }
}
