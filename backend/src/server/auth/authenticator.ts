import type { Player as PlayerType } from "../store/player/player";
import { Player } from "../store/player/player";
import type { PlayerStore } from "../store/player/player-store";
import type { SessionStore } from "../store/session/session-store";
import type { TokenStore } from "../store/token/token-store";
import type { WebSocket } from "../types";
import type { PlayerError, Result, TokenError } from "../types/result";
import { err, ok } from "../types/result";
import { PLAYER_NOT_FOUND } from "../types/result";

export interface IdentifyResult {
  player: PlayerType;
  token: string;
  authToken: string | null;
  resumed: boolean;
}

export type IdentifyError = PlayerError | TokenError;

export interface Authenticator {
  identify(ws: WebSocket, token?: string, authToken?: string): Promise<Result<IdentifyResult, IdentifyError>>;
}

export class GuestAuthenticator implements Authenticator {
  constructor(
    private sessions: SessionStore,
    private players: PlayerStore,
    private authTokens: TokenStore,
  ) {}

  async identify(ws: WebSocket, token?: string, _authToken?: string): Promise<Result<IdentifyResult, IdentifyError>> {
    if (token) {
      const session = this.sessions.byToken(token);
      if (session) {
        const playerResult = await this.players.findById(session.playerId);

        if (playerResult.ok) {
          const player = playerResult.value;
          this.sessions.resume(token, ws);
          return ok({
            player,
            token,
            authToken: null,
            resumed: true,
          });
        }
        return err(PLAYER_NOT_FOUND);
      }
    }
    const player = Player.createGuest();
    const saveResult = await this.players.save(player);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }
    const authResult = await this.authTokens.issue(player.pid);
    if (!authResult.ok) {
      return err(authResult.error);
    }
    const sessionToken = crypto.randomUUID();
    this.sessions.open(ws, player.pid);
    return ok({
      player,
      token: sessionToken,
      authToken: authResult.value.token,
      resumed: false,
    });
  }
}
