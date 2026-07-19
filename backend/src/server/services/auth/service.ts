import { logger as rootLogger } from "../../../logging/logger";
import type { Store } from "../../store/store";
import type { AuthSession, LoginInput, PlayerSummary, RegisterInput } from "../../types/auth";
import type { AuthError, Result } from "../../types/result";
import { err, ok } from "../../types/result";
import { NOT_AUTHENTICATED } from "../../types/result";
import { GoogleAuth } from "./google";
import { PasswordAuth } from "./password";

const log = rootLogger.child({ module: "AuthService" });

export type AuthResult = Result<AuthSession, AuthError>;

export class AuthService {
  private passwordAuth: PasswordAuth;
  private googleAuth: GoogleAuth;

  constructor(private store: Store) {
    this.passwordAuth = new PasswordAuth(store);
    this.googleAuth = new GoogleAuth(store);
  }

  register(input: RegisterInput): Promise<AuthResult> {
    return this.passwordAuth.register(input);
  }

  login(input: LoginInput): Promise<AuthResult> {
    return this.passwordAuth.login(input);
  }

  verify(idToken: string): Promise<AuthResult> {
    return this.googleAuth.signin(idToken);
  }

  async identify(token: string | undefined): Promise<Result<PlayerSummary, AuthError>> {
    if (!token) {
      return err(NOT_AUTHENTICATED);
    }

    const tokenResult = await this.store.tokens.findByToken(token);
    if (!tokenResult.ok) {
      return err(NOT_AUTHENTICATED);
    }

    const playerResult = await this.store.players.findById(tokenResult.value.playerId);
    if (!playerResult.ok) {
      log.warn("[AuthService.identify:player-not-found]", { playerId: tokenResult.value.playerId });
      return err(NOT_AUTHENTICATED);
    }

    const player = playerResult.value;
    return ok({ playerId: player.pid, username: player.username, provider: player.provider });
  }

  async discard(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.store.tokens.revoke(token);
  }
}
