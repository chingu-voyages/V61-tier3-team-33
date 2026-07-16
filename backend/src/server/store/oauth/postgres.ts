import { sql } from "../../../db/postgres";
import { logger as rootLogger } from "../../../logging/logger";
import { PG_CONSTRAINT, PG_UNIQUE_VIOLATION } from "../../types/pg";
import type { Result } from "../../types/result";
import type { OAuthError } from "../../types/result";
import { err, ok } from "../../types/result";
import { OAUTH_NOT_FOUND, OAUTH_PLAYER_ID_TAKEN, OAUTH_PLAYER_MISSING, OAUTH_SUBJECT_TAKEN } from "../../types/result";
import { OAuth, type OAuthIdentity, type OAuthIdentityRow } from "./oauth-identity";
import type { OAuthStore } from "./oauth-store";

const log = rootLogger.child({ module: "PostgresOAuth" });

export class PostgresOAuth implements OAuthStore {
  async findBySubject(provider: "google", sub: string): Promise<Result<OAuthIdentity, OAuthError>> {
    const [row] = await sql<OAuthIdentityRow[]>`
      SELECT pid, provider, sub, email, created_at
      FROM oauth
      WHERE provider = ${provider}
        AND sub = ${sub}
    `;
    if (!row) {
      log.warn("[PostgresOAuth.findBySubject:not-found]", { provider, sub });
      return err(OAUTH_NOT_FOUND);
    }
    return ok(OAuth.fromRow(row));
  }

  async findByPlayerId(playerId: string): Promise<Result<OAuthIdentity, OAuthError>> {
    const [row] = await sql<OAuthIdentityRow[]>`
      SELECT pid, provider, sub, email, created_at
      FROM oauth
      WHERE pid = ${playerId}
    `;
    if (!row) {
      log.warn("[PostgresOAuth.findByPlayerId:not-found]", { playerId });
      return err(OAUTH_NOT_FOUND);
    }
    return ok(OAuth.fromRow(row));
  }

  async save(identity: OAuthIdentity): Promise<Result<void, OAuthError>> {
    const playerExists = await sql`SELECT 1 FROM players WHERE pid = ${identity.playerId}`;
    if (playerExists.length === 0) {
      log.warn("[PostgresOAuth.save:player-missing]", { playerId: identity.playerId });
      return err(OAUTH_PLAYER_MISSING);
    }

    try {
      await sql`
        INSERT INTO oauth (pid, provider, sub, email, created_at)
        VALUES (
          ${identity.playerId},
          ${identity.provider},
          ${identity.providerSub},
          ${identity.email},
          to_timestamp(${identity.createdAt} / 1000.0)
        )
      `;
      log.info("[PostgresOAuth.save:saved]", { playerId: identity.playerId });
      return ok();
    } catch (e: unknown) {
      const pgErr = e as { errno?: string; constraint?: string };
      if (pgErr.errno === PG_UNIQUE_VIOLATION) {
        if (pgErr.constraint === PG_CONSTRAINT.OAUTH_PKEY) {
          log.warn("[PostgresOAuth.save:player-id-taken]", { playerId: identity.playerId });
          return err(OAUTH_PLAYER_ID_TAKEN);
        }
        if (pgErr.constraint === PG_CONSTRAINT.OAUTH_PROVIDER_SUB_IDX) {
          log.warn("[PostgresOAuth.save:subject-taken]", { provider: identity.provider, sub: identity.providerSub });
          return err(OAUTH_SUBJECT_TAKEN);
        }
      }
      log.error("[PostgresOAuth.save:unexpected-error]", { error: e });
      throw e;
    }
  }
}
