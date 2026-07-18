import { HttpGoogleTokenVerifier } from "../auth/google-token-verifier";
import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { authRoutes } from "./auth-routes";
import { POSTGRES } from "../types/store";
import { createPlayerStore } from "../store/player/player-store";
import { createCredentialStore } from "../store/credential/credential-store";
import { createOAuthStore } from "../store/oauth/oauth-store";
import { MemoryTokens } from "../store/token/memory";
import { createTokenStore } from "../store/token/token-store";
import{ createFriendStore, type FriendStore } from "../friend/friend-store";
import { DefaultFriendService } from "../friend/friend-service";
import { friendRoutes } from "./friend-routes";
// Infrastructure
const storeKind=POSTGRES
const players = createPlayerStore(storeKind);
const credentials = createCredentialStore(storeKind,players);
const identities = createOAuthStore(storeKind,players);
const authTokens = createTokenStore(storeKind,players)
const friends = createFriendStore(storeKind)
// External services
const verifier = new HttpGoogleTokenVerifier(
  Bun.env.GOOGLE_CLIENT_ID ?? ""
);

// Application service
const restAuthenticator = new DefaultRestAuthenticator(
  players,
  credentials,
  identities,
  authTokens,
  verifier
);
const friendService = new DefaultFriendService(
  friends,
  players,
);
// Export the auth plugin
export const authPlugin = authRoutes(
  restAuthenticator,
  authTokens,
  players
);
export const friendPlugin = friendRoutes(friendService);