import type { Publisher } from "../events/hub";
import type { StoreKind } from "../types/store";
import type { CredentialStore } from "./credential/credential-store";
import { createCredentialStore } from "./credential/credential-store";
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
 * Every persistence seam the server needs, in one place. The WS transport (via `Mediator`)
 * only touches `games`/`sessions`; the REST API (via `api/bootstrap.ts`) only touches
 * `players`/`credentials`/`identities`/`tokens` — but both read from the same instance,
 * so there is exactly one player store, one token store, etc. in the running process.
 */
export interface Store {
  players: PlayerStore;
  credentials: CredentialStore;
  identities: OAuthStore;
  tokens: TokenStore;
  games: GameStore;
  sessions: SessionStore;
}

/**
 * Builds every store from a single `StoreKind`. `players`/`credentials`/`identities`/`tokens`
 * switch between Memory and Postgres per `kind` (via their existing `create*Store` factories);
 * `games`/`sessions` have no Postgres adapter yet, so they're always in-memory regardless of
 * `kind` (see the auth-refactor spec's Out of Scope — no new store adapters here).
 */
export function createStore(kind: StoreKind, publisher: Publisher): Store {
  const players = createPlayerStore(kind);
  const credentials = createCredentialStore(kind, players);
  const identities = createOAuthStore(kind, players);
  const tokens = createTokenStore(kind, players);
  const games = new Games(publisher);
  const sessions = new Sessions();

  return { players, credentials, identities, tokens, games, sessions };
}
