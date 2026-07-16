import { sql } from "../../../db/postgres";
import { logger as rootLogger } from "../../../logging/logger";
import { PG_CONSTRAINT, PG_UNIQUE_VIOLATION } from "../../types/pg";
import type { Result } from "../../types/result";
import type { CredentialError } from "../../types/result";
import { err, ok } from "../../types/result";
import { CREDENTIAL_NOT_FOUND, EMAIL_TAKEN, PLAYER_ID_TAKEN, PLAYER_MISSING } from "../../types/result";
import { Credential, type PasswordCredential, type PasswordCredentialRow } from "./credential";
import type { CredentialStore } from "./credential-store";

const log = rootLogger.child({ module: "PostgresCredentials" });

export class PostgresCredentials implements CredentialStore {
  async findByEmail(email: string): Promise<Result<PasswordCredential, CredentialError>> {
    const [row] = await sql<PasswordCredentialRow[]>`
      SELECT pid, email, hash, created_at
      FROM creds
      WHERE LOWER(email) = LOWER(${email})
    `;
    if (!row) {
      log.warn("[PostgresCredentials.findByEmail:not-found]", { email });
      return err(CREDENTIAL_NOT_FOUND);
    }
    return ok(Credential.fromRow(row));
  }

  async findByPlayerId(playerId: string): Promise<Result<PasswordCredential, CredentialError>> {
    const [row] = await sql<PasswordCredentialRow[]>`
      SELECT pid, email, hash, created_at
      FROM creds
      WHERE pid = ${playerId}
    `;
    if (!row) {
      log.warn("[PostgresCredentials.findByPlayerId:not-found]", { playerId });
      return err(CREDENTIAL_NOT_FOUND);
    }
    return ok(Credential.fromRow(row));
  }

  async save(credential: PasswordCredential): Promise<Result<void, CredentialError>> {
    const playerExists = await sql`SELECT 1 FROM players WHERE pid = ${credential.playerId}`;
    if (playerExists.length === 0) {
      log.warn("[PostgresCredentials.save:player-missing]", { playerId: credential.playerId });
      return err(PLAYER_MISSING);
    }

    const lowerEmail = credential.email.toLowerCase();

    try {
      await sql`
        INSERT INTO creds (pid, email, hash, created_at)
        VALUES (
          ${credential.playerId},
          ${lowerEmail},
          ${credential.passwordHash},
          to_timestamp(${credential.createdAt} / 1000.0)
        )
      `;
      log.info("[PostgresCredentials.save:saved]", { playerId: credential.playerId });
      return ok();
    } catch (e: unknown) {
      const pgErr = e as { errno?: string; constraint?: string };
      if (pgErr.errno === PG_UNIQUE_VIOLATION) {
        if (pgErr.constraint === PG_CONSTRAINT.CREDS_PKEY) {
          log.warn("[PostgresCredentials.save:player-id-taken]", { playerId: credential.playerId });
          return err(PLAYER_ID_TAKEN);
        }
        if (pgErr.constraint === PG_CONSTRAINT.CREDS_EMAIL_IDX) {
          log.warn("[PostgresCredentials.save:email-taken]", { email: lowerEmail });
          return err(EMAIL_TAKEN);
        }
      }
      log.error("[PostgresCredentials.save:unexpected-error]", { error: e });
      throw e;
    }
  }
}
