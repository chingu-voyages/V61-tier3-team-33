import { createGuestPlayer, type Player } from "../players/player";
import type { Players } from "../players/players";
import type { AuthTokens } from "./auth-token";
import type { SessionStore } from "../session/session-store";
import type { WebSocket } from "../domain/types";
export interface IdentifyResult {
    player: Player;
    token: string;             // session token, same meaning as today
    authToken: string | null;  // non-null ONLY for a brand-new guest (Branch B)
    resumed: boolean;          // true iff the SAME live session was reattached
  }
  export interface Authenticator {
    identify(ws: WebSocket, token?: string, authToken?: string): Promise<IdentifyResult>;
  }
  export class GuestAuthenticator implements Authenticator {
    constructor(
      private sessions: SessionStore,
      private players: Players,
      private authTokens: AuthTokens){};

      async identify(ws: WebSocket, token?: string, authToken?: string): Promise<IdentifyResult> {
        if(token){
          const session=this.sessions.byToken(token)
          if(session){
            const player= await this.players.findById(session.playerId)

            if (player) {

              // resume session
              this.sessions.resume(token,ws);
              return {
                  player,
                  token,
                  authToken: null,
                  resumed: true,
              };
          }
          }
        }
        //create guest player
        const player=createGuestPlayer();
        await this.players.save(player);
        const auth = await this.authTokens.issue(player.id);
        const sessionToken = crypto.randomUUID();
         this.sessions.open(ws,player.id);
        return {
          player,
          token: sessionToken,
          authToken: auth.token,
          resumed: false,
      };
      }
  }