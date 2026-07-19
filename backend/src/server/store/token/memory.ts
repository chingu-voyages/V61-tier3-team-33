import { logger as rootLogger } from "../../../logging/logger";
import type { Result } from "../../types/result";
import type { TokenError } from "../../types/result";
import { err, ok } from "../../types/result";
import { TOKEN_NOT_FOUND, TOKEN_PLAYER_MISSING } from "../../types/result";
import type { PlayerReader } from "../player/player-store";
import type { AuthToken } from "./token";
import type { TokenStore } from "./token-store";
import { TOKEN_TTL_MS } from "./token-store";

const log = rootLogger.child({ module: "MemoryTokens" });

export class MemoryTokens implements TokenStore {
  private byToken = new Map<string, AuthToken>();

  constructor(private players: PlayerReader) {}

  async issue(playerId: string): Promise<Result<AuthToken, TokenError>> {
    const playerResult = await this.players.findById(playerId);
    if (!playerResult.ok) {
      log.warn("[MemoryTokens.issue:player-missing]", { playerId });
      return err(TOKEN_PLAYER_MISSING);
    }

    const now = Date.now();
    const token: AuthToken = {
      token: crypto.randomUUID(),
      playerId,
      issuedAt: now,
      expiresAt: now + TOKEN_TTL_MS,
    };

    this.byToken.set(token.token, token);
    log.info("[MemoryTokens.issue:issued]", { token: token.token.slice(0, 8), playerId });
    return ok(token);
  }

  async findByToken(token: string): Promise<Result<AuthToken, TokenError>> {
    const found = this.byToken.get(token);
    if (!found || Date.now() > found.expiresAt) {
      log.warn("[MemoryTokens.findByToken:not-found-or-expired]", { token: token.slice(0, 8) });
      return err(TOKEN_NOT_FOUND);
    }
    return ok(found);
  }

  async revoke(token: string): Promise<Result<void, TokenError>> {
    this.byToken.delete(token);
    return ok();
  }
}
