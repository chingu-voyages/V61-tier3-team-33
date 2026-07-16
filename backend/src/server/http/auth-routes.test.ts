import { beforeEach } from "bun:test";

import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { MemoryCredentials } from "../store/credential/memory";
import { MemoryOAuth } from "../store/oauth/memory";
import { MemoryPlayers } from "../store/player/memory";
import { MemoryTokens } from "../store/token/memory";

class FakeGoogleVerifier {
  async verify() {
    return null;
  }
}

let players: MemoryPlayers;
let credentials: MemoryCredentials;
let identities: MemoryOAuth;
let authTokens: MemoryTokens;

beforeEach(() => {
  players = new MemoryPlayers();
  credentials = new MemoryCredentials(players);
  identities = new MemoryOAuth(players);
  authTokens = new MemoryTokens(players);

  new DefaultRestAuthenticator(players, credentials, identities, authTokens, new FakeGoogleVerifier());
});
