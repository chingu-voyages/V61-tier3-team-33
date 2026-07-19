import { logger as rootLogger } from "../../../logging/logger";
import type { Result } from "../../types/result";
import type { OAuthError } from "../../types/result";
import { err, ok } from "../../types/result";
import { OAUTH_NOT_FOUND, OAUTH_PLAYER_ID_TAKEN, OAUTH_PLAYER_MISSING, OAUTH_SUBJECT_TAKEN } from "../../types/result";
import type { PlayerReader } from "../player/player-store";
import type { OAuthIdentity } from "./oauth-identity";
import type { OAuthStore } from "./oauth-store";

const log = rootLogger.child({ module: "MemoryOAuth" });

export class MemoryOAuth implements OAuthStore {
  private byPlayerId = new Map<string, OAuthIdentity>();
  private byProviderSub = new Map<string, OAuthIdentity>();

  constructor(private players: PlayerReader) {}

  async findBySubject(provider: "google", sub: string): Promise<Result<OAuthIdentity, OAuthError>> {
    const key = `${provider}:${sub}`;
    const identity = this.byProviderSub.get(key);
    if (!identity) {
      log.warn("[MemoryOAuth.findBySubject:not-found]", { provider, sub });
      return err(OAUTH_NOT_FOUND);
    }
    return ok(identity);
  }

  async findByPlayerId(playerId: string): Promise<Result<OAuthIdentity, OAuthError>> {
    const identity = this.byPlayerId.get(playerId);
    if (!identity) {
      log.warn("[MemoryOAuth.findByPlayerId:not-found]", { playerId });
      return err(OAUTH_NOT_FOUND);
    }
    return ok(identity);
  }

  async save(identity: OAuthIdentity): Promise<Result<void, OAuthError>> {
    const playerResult = await this.players.findById(identity.playerId);
    if (!playerResult.ok) {
      log.warn("[MemoryOAuth.save:player-missing]", { playerId: identity.playerId });
      return err(OAUTH_PLAYER_MISSING);
    }

    if (this.byPlayerId.has(identity.playerId)) {
      log.warn("[MemoryOAuth.save:player-id-taken]", { playerId: identity.playerId });
      return err(OAUTH_PLAYER_ID_TAKEN);
    }

    const key = `${identity.provider}:${identity.providerSub}`;
    if (this.byProviderSub.has(key)) {
      log.warn("[MemoryOAuth.save:subject-taken]", { provider: identity.provider, sub: identity.providerSub });
      return err(OAUTH_SUBJECT_TAKEN);
    }

    this.byPlayerId.set(identity.playerId, identity);
    this.byProviderSub.set(key, identity);
    log.info("[MemoryOAuth.save:saved]", { playerId: identity.playerId });
    return ok();
  }
}
