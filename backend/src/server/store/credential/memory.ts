import { logger as rootLogger } from "../../../logging/logger";
import type { Result } from "../../types/result";
import type { CredentialError } from "../../types/result";
import { err, ok } from "../../types/result";
import { CREDENTIAL_NOT_FOUND, EMAIL_TAKEN, PLAYER_ID_TAKEN, PLAYER_MISSING } from "../../types/result";
import type { PlayerReader } from "../player/player-store";
import type { PasswordCredential } from "./credential";
import type { CredentialStore } from "./credential-store";

const log = rootLogger.child({ module: "MemoryCredentials" });

export class MemoryCredentials implements CredentialStore {
  /** lowercase(email) → PasswordCredential (uniqueness + lookup) */
  private byEmail = new Map<string, PasswordCredential>();
  /** playerId → PasswordCredential (one credential per player) */
  private byPlayerId = new Map<string, PasswordCredential>();

  constructor(private players: PlayerReader) {}

  async findByEmail(email: string): Promise<Result<PasswordCredential, CredentialError>> {
    const cred = this.byEmail.get(email.toLowerCase());
    if (!cred) {
      log.warn("[MemoryCredentials.findByEmail:not-found]", { email });
      return err(CREDENTIAL_NOT_FOUND);
    }
    return ok(cred);
  }

  async findByPlayerId(playerId: string): Promise<Result<PasswordCredential, CredentialError>> {
    const cred = this.byPlayerId.get(playerId);
    if (!cred) {
      log.warn("[MemoryCredentials.findByPlayerId:not-found]", { playerId });
      return err(CREDENTIAL_NOT_FOUND);
    }
    return ok(cred);
  }

  async save(credential: PasswordCredential): Promise<Result<void, CredentialError>> {
    const playerResult = await this.players.findById(credential.playerId);
    if (!playerResult.ok) {
      log.warn("[MemoryCredentials.save:player-missing]", { playerId: credential.playerId });
      return err(PLAYER_MISSING);
    }

    if (this.byPlayerId.has(credential.playerId)) {
      log.warn("[MemoryCredentials.save:player-id-taken]", { playerId: credential.playerId });
      return err(PLAYER_ID_TAKEN);
    }

    const lowerEmail = credential.email.toLowerCase();
    if (this.byEmail.has(lowerEmail)) {
      log.warn("[MemoryCredentials.save:email-taken]", { email: lowerEmail });
      return err(EMAIL_TAKEN);
    }

    const normalized: PasswordCredential = {
      ...credential,
      email: lowerEmail,
    };

    this.byEmail.set(lowerEmail, normalized);
    this.byPlayerId.set(normalized.playerId, normalized);
    log.info("[MemoryCredentials.save:saved]", { playerId: credential.playerId });
    return ok();
  }
}
