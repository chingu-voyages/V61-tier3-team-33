import { logger as rootLogger } from "../../../logging/logger";
import { PASSWORD, Player } from "../../store/player/player";
import type { Store } from "../../store/store";
import type { AuthSession, LoginInput, RegisterInput } from "../../types/auth";
import type { AuthError, Result } from "../../types/result";
import { err, ok } from "../../types/result";
import { EMAIL_TAKEN, INTERNAL_ERROR, INVALID_CREDENTIALS, USERNAME_TAKEN } from "../../types/result";

const log = rootLogger.child({ module: "PasswordAuth" });

export class PasswordAuth {
  constructor(private store: Store) {}

  async register(input: RegisterInput): Promise<Result<AuthSession, AuthError>> {
    const normalizedEmail = input.email.trim().toLowerCase();

    let passwordHash: string;
    try {
      passwordHash = await Bun.password.hash(input.password, {
        algorithm: "argon2id",
      });
    } catch (e) {
      log.error("[PasswordAuth.register:hash-failed]", { error: String(e) });
      return err(INTERNAL_ERROR);
    }

    const player = Player.create(input.username, PASSWORD);
    const saveResult = await this.store.players.save(player);
    if (!saveResult.ok) {
      if (saveResult.error === USERNAME_TAKEN) return err(USERNAME_TAKEN);
      log.error("[PasswordAuth.register:player-save-failed]", { username: input.username });
      return err(INTERNAL_ERROR);
    }

    const credResult = await this.store.credentials.save({
      playerId: player.pid,
      email: normalizedEmail,
      passwordHash,
      createdAt: Date.now(),
    });
    if (!credResult.ok) {
      // Cleanup: remove the orphaned player if credential save fails
      const cleanup = await this.store.players.delete(player.pid);
      if (!cleanup.ok) {
        log.error("[PasswordAuth.register:cleanup-failed]", { playerId: player.pid });
      }

      if (credResult.error === EMAIL_TAKEN) {
        log.warn("[PasswordAuth.register:email-taken]", { email: normalizedEmail });
        return err(EMAIL_TAKEN);
      }
      log.error("[PasswordAuth.register:cred-save-failed]", { playerId: player.pid });
      return err(INTERNAL_ERROR);
    }

    const tokenResult = await this.store.tokens.issue(player.pid);
    if (!tokenResult.ok) {
      log.error("[PasswordAuth.register:token-issue-failed]", { playerId: player.pid });
      return err(INTERNAL_ERROR);
    }

    log.info("[PasswordAuth.register:success]", { playerId: player.pid });
    return ok({ playerId: player.pid, username: player.username, token: tokenResult.value.token });
  }

  async login(input: LoginInput): Promise<Result<AuthSession, AuthError>> {
    let player: Player;
    let passwordHash: string;

    if (input.login.includes("@")) {
      const normalizedEmail = input.login.trim().toLowerCase();
      const emailResult = await this.store.credentials.findByEmail(normalizedEmail);
      if (!emailResult.ok) {
        log.warn("[PasswordAuth.login:email-not-found]", { login: normalizedEmail });
        return err(INVALID_CREDENTIALS);
      }

      const playerResult = await this.store.players.findById(emailResult.value.playerId);
      if (!playerResult.ok) {
        log.error("[PasswordAuth.login:player-not-found]", { playerId: emailResult.value.playerId });
        return err(INTERNAL_ERROR);
      }

      player = playerResult.value;
      passwordHash = emailResult.value.passwordHash;
    } else {
      const usernameResult = await this.store.players.findByUsername(input.login);
      if (!usernameResult.ok) {
        log.warn("[PasswordAuth.login:username-not-found]", { login: input.login });
        return err(INVALID_CREDENTIALS);
      }

      player = usernameResult.value;
      const credResult = await this.store.credentials.findByPlayerId(player.pid);
      if (!credResult.ok) {
        log.warn("[PasswordAuth.login:no-credentials]", { playerId: player.pid });
        return err(INVALID_CREDENTIALS);
      }

      passwordHash = credResult.value.passwordHash;
    }

    let passwordVerified: boolean;
    try {
      passwordVerified = await Bun.password.verify(input.password, passwordHash);
    } catch (e) {
      log.error("[PasswordAuth.login:verify-failed]", { error: String(e) });
      return err(INTERNAL_ERROR);
    }

    if (!passwordVerified) {
      log.warn("[PasswordAuth.login:wrong-password]", { login: input.login });
      return err(INVALID_CREDENTIALS);
    }

    const tokenResult = await this.store.tokens.issue(player.pid);
    if (!tokenResult.ok) {
      log.error("[PasswordAuth.login:token-issue-failed]", { playerId: player.pid });
      return err(INTERNAL_ERROR);
    }

    log.info("[PasswordAuth.login:success]", { playerId: player.pid });
    return ok({ playerId: player.pid, username: player.username, token: tokenResult.value.token });
  }
}
