import config from "../../../config/config";
import { logger as rootLogger } from "../../../logging/logger";
import { GOOGLE, Player } from "../../store/player/player";
import type { Store } from "../../store/store";
import type { AuthSession } from "../../types/auth";
import type { AuthError, Result } from "../../types/result";
import { err, ok } from "../../types/result";
import { INTERNAL_ERROR, INVALID_GOOGLE_TOKEN } from "../../types/result";

const log = rootLogger.child({ module: "GoogleAuth" });

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export type CheckError = typeof INVALID_GOOGLE_TOKEN | typeof INTERNAL_ERROR;

type AuthResult = Result<AuthSession, AuthError>;

export class GoogleAuth {
  constructor(private store: Pick<Store, "identities" | "players" | "tokens">) {}

  async check(idToken: string): Promise<Result<GoogleProfile, CheckError>> {
    const clientId = config.googleClientId || process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) {
      return err(INTERNAL_ERROR);
    }

    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

      if (!response.ok) {
        return err(INVALID_GOOGLE_TOKEN);
      }

      const data = (await response.json()) as Record<string, unknown>;

      if (data.aud !== clientId) {
        return err(INVALID_GOOGLE_TOKEN);
      }

      return ok({
        sub: String(data.sub ?? ""),
        email: String(data.email ?? ""),
        emailVerified: String(data.email_verified ?? "") === "true",
      });
    } catch {
      return err(INVALID_GOOGLE_TOKEN);
    }
  }

  async signin(idToken: string): Promise<AuthResult> {
    const profileResult = await this.check(idToken);
    if (!profileResult.ok) {
      log.warn("[GoogleAuth.signin:check-failed]", { error: profileResult.error });
      return err(profileResult.error);
    }

    const profile = profileResult.value;

    if (!profile.emailVerified) {
      log.warn("[GoogleAuth.signin:email-not-verified]", { sub: profile.sub });
      return err(INVALID_GOOGLE_TOKEN);
    }

    const identityResult = await this.store.identities.findBySubject("google", profile.sub);
    if (identityResult.ok) {
      const playerResult = await this.store.players.findById(identityResult.value.playerId);
      if (!playerResult.ok) {
        log.error("[GoogleAuth.signin:player-not-found]", { playerId: identityResult.value.playerId });
        return err(INTERNAL_ERROR);
      }

      const tokenResult = await this.store.tokens.issue(identityResult.value.playerId);
      if (!tokenResult.ok) {
        log.error("[GoogleAuth.signin:token-issue-failed]", { playerId: identityResult.value.playerId });
        return err(INTERNAL_ERROR);
      }

      log.info("[GoogleAuth.signin:existing-user]", { playerId: identityResult.value.playerId });
      return ok({
        playerId: identityResult.value.playerId,
        username: playerResult.value.username,
        token: tokenResult.value.token,
      });
    }

    if (!profile.email) {
      log.warn("[GoogleAuth.signin:no-email]", { sub: profile.sub });
      return err(INVALID_GOOGLE_TOKEN);
    }

    const baseUsername = profile.email.split("@")[0] || "google-user";
    let username = baseUsername;

    while ((await this.store.players.findByUsername(username)).ok) {
      const suffix = crypto.randomUUID().slice(0, 4);
      username = `${baseUsername}-${suffix}`;
    }

    const player = Player.create(username, GOOGLE);
    const saveResult = await this.store.players.save(player);
    if (!saveResult.ok) {
      log.error("[GoogleAuth.signin:player-save-failed]", { username });
      return err(INTERNAL_ERROR);
    }

    const identitySaveResult = await this.store.identities.save({
      playerId: player.pid,
      provider: "google",
      providerSub: profile.sub,
      email: profile.email,
      createdAt: Date.now(),
    });
    if (!identitySaveResult.ok) {
      log.error("[GoogleAuth.signin:identity-save-failed]", { playerId: player.pid });
      return err(INTERNAL_ERROR);
    }

    const tokenResult = await this.store.tokens.issue(player.pid);
    if (!tokenResult.ok) {
      log.error("[GoogleAuth.signin:token-issue-failed]", { playerId: player.pid });
      return err(INTERNAL_ERROR);
    }

    log.info("[GoogleAuth.signin:new-user]", { playerId: player.pid, username });
    return ok({ playerId: player.pid, username, token: tokenResult.value.token });
  }
}
