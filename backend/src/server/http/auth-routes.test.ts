import { beforeEach } from "bun:test";

import { InMemoryAuthToken } from "../auth/in-memory-auth-token";
import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { InMemoryCredentials } from "../players/credential/in-memory-credentials";
import { InMemoryOAuthIdentities } from "../players/credential/Oauth/in-memory-oauth-identities";
import { InMemoryPlayers } from "../players/inMemortPlayers.class";

class FakeGoogleVerifier {
  async verify() {
    return null;
  }
}

let players: InMemoryPlayers;
let credentials: InMemoryCredentials;
let identities: InMemoryOAuthIdentities;
let authTokens: InMemoryAuthToken;

beforeEach(() => {
  players = new InMemoryPlayers();
  credentials = new InMemoryCredentials();
  identities = new InMemoryOAuthIdentities();
  authTokens = new InMemoryAuthToken();

  new DefaultRestAuthenticator(players, credentials, identities, authTokens, new FakeGoogleVerifier());
});
