import type { CredentialStore } from "../store/credential/credential-store";
import type { OAuthStore } from "../store/oauth/oauth-store";
import { GOOGLE, PASSWORD, Player } from "../store/player/player";
import type { PlayerStore } from "../store/player/player-store";
import type { TokenStore } from "../store/token/token-store";
import type { AuthError, Result } from "../types/result";
import { err, ok } from "../types/result";
import {
  EMAIL_TAKEN,
  INTERNAL_ERROR,
  INVALID_CREDENTIALS,
  INVALID_GOOGLE_TOKEN,
  INVALID_PAYLOAD,
  USERNAME_TAKEN,
} from "../types/result";
import type { GoogleTokenVerifier } from "./google-token-verifier";

export interface RestAuthenticator {
  register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<Result<{ playerId: string; authToken: string }, AuthError>>;

  login(input: {
    email: string;
    password: string;
  }): Promise<Result<{ playerId: string; authToken: string }, AuthError>>;

  loginWithGoogle(idToken: string): Promise<Result<{ playerId: string; authToken: string }, AuthError>>;
}

export class DefaultRestAuthenticator implements RestAuthenticator {
  constructor(
    private players: PlayerStore,
    private credentials: CredentialStore,
    private identities: OAuthStore,
    private authTokens: TokenStore,
    private verifier: GoogleTokenVerifier,
  ) {}

  async register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<Result<{ playerId: string; authToken: string }, AuthError>> {
    const trimmedUsername = input.username?.trim() ?? "";
    const email = input.email?.trim() ?? "";
    const password = input.password ?? "";

    const isUsernameValid = trimmedUsername.length >= 3 && trimmedUsername.length <= 20;
    const isPasswordValid = password.length >= 8;
    const isEmailValid = email.includes("@") && email.indexOf(".", email.indexOf("@")) > -1;

    if (!isUsernameValid || !isPasswordValid || !isEmailValid) {
      return err(INVALID_PAYLOAD);
    }
    console.log("1");
    const normalizedEmail = email.toLowerCase();
    const existingCreds = await this.credentials.findByEmail(normalizedEmail);
    console.log("2");
    if (existingCreds.ok) {
      return err(EMAIL_TAKEN);
    }

    const existingPlayer = await this.players.findByUsername(trimmedUsername);
    console.log("3");
    if (existingPlayer.ok) {
      return err(USERNAME_TAKEN);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    const player = Player.create(trimmedUsername, PASSWORD);
    const saveResult = await this.players.save(player);console.log("4")
    if (!saveResult.ok) {
      return err(INTERNAL_ERROR);
    }

    const credResult = await this.credentials.save({
      playerId: player.pid,
      email: normalizedEmail,
      passwordHash,
      createdAt: Date.now(),
    });console.log("5");
    if (!credResult.ok) {
      return err(INTERNAL_ERROR);
    }

    const authTokenResult = await this.authTokens.issue(player.pid);console.log("6");
    if (!authTokenResult.ok) {
      return err(INTERNAL_ERROR);
    }

    return ok({
      playerId: player.pid,
      authToken: authTokenResult.value.token,
    });
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<Result<{ playerId: string; authToken: string }, AuthError>> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const verifiedEmailResult = await this.credentials.findByEmail(normalizedEmail);

    if (!verifiedEmailResult.ok) {
      return err(INVALID_CREDENTIALS);
    }
    const verifiedEmail = verifiedEmailResult.value;
    const verifiedPassword = await Bun.password.verify(input.password, verifiedEmail.passwordHash);
    if (!verifiedPassword) {
      return err(INVALID_CREDENTIALS);
    }
    const playerResult = await this.players.findById(verifiedEmail.playerId);
    if (!playerResult.ok) {
      return err(INTERNAL_ERROR);
    }
    const player = playerResult.value;

    const authTokenResult = await this.authTokens.issue(player.pid);
    if (!authTokenResult.ok) {
      return err(INTERNAL_ERROR);
    }

    return ok({
      playerId: player.pid,
      authToken: authTokenResult.value.token,
    });
  }

  async loginWithGoogle(idToken: string): Promise<Result<{ playerId: string; authToken: string }, AuthError>> {
    const profile = await this.verifier.verify(idToken);

    if (!profile || !profile.emailVerified) {
      return err(INVALID_GOOGLE_TOKEN);
    }

    const identityResult = await this.identities.findBySubject("google", profile.sub);

    if (identityResult.ok) {
      const identity = identityResult.value;
      const authTokenResult = await this.authTokens.issue(identity.playerId);
      if (!authTokenResult.ok) {
        return err(INTERNAL_ERROR);
      }

      return ok({
        playerId: identity.playerId,
        authToken: authTokenResult.value.token,
      });
    }

    if (!profile.email) {
      return err(INVALID_GOOGLE_TOKEN);
    }

    const baseUsername = profile.email.split("@")[0] || "google-user";
    let username = baseUsername;

    while ((await this.players.findByUsername(username)).ok) {
      const suffix = crypto.randomUUID().slice(0, 4);
      username = `${baseUsername}-${suffix}`;
    }

    const player = Player.create(username, GOOGLE);
    const saveResult = await this.players.save(player);
    if (!saveResult.ok) {
      return err(INTERNAL_ERROR);
    }

    const identitySaveResult = await this.identities.save({
      playerId: player.pid,
      provider: "google",
      providerSub: profile.sub,
      email: profile.email,
      createdAt: Date.now(),
    });
    if (!identitySaveResult.ok) {
      return err(INTERNAL_ERROR);
    }

    const authTokenResult = await this.authTokens.issue(player.pid);
    if (!authTokenResult.ok) {
      return err(INTERNAL_ERROR);
    }

    return ok({
      playerId: player.pid,
      authToken: authTokenResult.value.token,
    });
  }
}
