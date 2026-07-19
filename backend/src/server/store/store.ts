import type { Publisher } from "../events/hub";
import type { StoreKind } from "../types/store";
import type { CredentialStore } from "./credential/credential-store";
import { createCredentialStore } from "./credential/credential-store";
import type { FriendStore } from "./friend/friend-store";
import { createFriendStore } from "./friend/friend-store";
import type { GameStore } from "./game/game-store";
import { Games } from "./game/games";
import type { OAuthStore } from "./oauth/oauth-store";
import { createOAuthStore } from "./oauth/oauth-store";
import type { PlayerStore } from "./player/player-store";
import { createPlayerStore } from "./player/player-store";
import type { SessionStore } from "./session/session-store";
import { Sessions } from "./session/sessions";
import type { TokenStore } from "./token/token-store";
import { createTokenStore } from "./token/token-store";

/**
 * Every persistence seam the server needs, in one place.
 */
export interface Store {
  players: PlayerStore;
  credentials: CredentialStore;
  identities: OAuthStore;
  tokens: TokenStore;
  friends: FriendStore;
  games: GameStore;
  sessions: SessionStore;
}

/**
 * Builds every store from a single `StoreKind`.
 */
export function createStore(kind: StoreKind, publisher: Publisher): Store {
  const players = createPlayerStore(kind);
  const credentials = createCredentialStore(kind, players);
  const identities = createOAuthStore(kind, players);
  const tokens = createTokenStore(kind, players);
  const friends = createFriendStore(kind);
  const games = new Games(publisher);
  const sessions = new Sessions();

  return { players, credentials, identities, tokens, friends, games, sessions };
}
