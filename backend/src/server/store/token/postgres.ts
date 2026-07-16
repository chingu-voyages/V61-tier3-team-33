import { sql } from "../../../db/postgres";
import { logger as rootLogger } from "../../../logging/logger";
import type { Result } from "../../types/result";
import type { TokenError } from "../../types/result";
import { err, ok } from "../../types/result";
import { TOKEN_NOT_FOUND, TOKEN_PLAYER_MISSING } from "../../types/result";
import { type AuthToken, type AuthTokenRow, Token } from "./token";
import type { TokenStore } from "./token-store";
import { TOKEN_TTL_MS } from "./token-store";

const log = rootLogger.child({ module: "PostgresTokens" });

export class PostgresTokens implements TokenStore {
  async issue(playerId: string): Promise<Result<AuthToken, TokenError>> {
    const playerExists = await sql`SELECT 1 FROM players WHERE pid = ${playerId}`;
    if (playerExists.length === 0) {
      log.warn("[PostgresTokens.issue:player-missing]", { playerId });
      return err(TOKEN_PLAYER_MISSING);
    }

    const token = crypto.randomUUID();
    const now = Date.now();

    await sql`
      INSERT INTO tokens (token, pid, issued_at, expires_at)
      VALUES (
        ${token},
        ${playerId},
        to_timestamp(${now} / 1000.0),
        to_timestamp(${now + TOKEN_TTL_MS} / 1000.0)
      )
    `;

    log.info("[PostgresTokens.issue:issued]", { token: token.slice(0, 8), playerId });
    return ok({ token, playerId, issuedAt: now, expiresAt: now + TOKEN_TTL_MS });
  }

  async findByToken(token: string): Promise<Result<AuthToken, TokenError>> {
    const [row] = await sql<AuthTokenRow[]>`
      SELECT token, pid, issued_at, expires_at
      FROM tokens
      WHERE token = ${token}
        AND expires_at > now()
    `;
    if (!row) {
      log.warn("[PostgresTokens.findByToken:not-found-or-expired]", { token: token.slice(0, 8) });
      return err(TOKEN_NOT_FOUND);
    }
    return ok(Token.fromRow(row));
  }

  async revoke(token: string): Promise<Result<void, TokenError>> {
    await sql`DELETE FROM tokens WHERE token = ${token}`;
    return ok();
  }
}
