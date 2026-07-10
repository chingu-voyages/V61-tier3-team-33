import { describe, expect, it, beforeEach } from "bun:test";
import { Elysia } from "elysia";

import { authRoutes } from "./auth-routes";

import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { InMemoryPlayers } from "../players/inMemortPlayers.class";
import { InMemoryCredentials } from "../players/credential/in-memory-credentials";
import { InMemoryOAuthIdentities } from "../players/credential/Oauth/in-memory-oauth-identities";
import { InMemoryAuthToken } from "../auth/in-memory-auth-token";

class FakeGoogleVerifier {
    async verify() {
        return null;
    }
}

let app: any;

let players: InMemoryPlayers;
let credentials: InMemoryCredentials;
let identities: InMemoryOAuthIdentities;
let authTokens: InMemoryAuthToken;

beforeEach(() => {
    players = new InMemoryPlayers();
    credentials = new InMemoryCredentials();
    identities = new InMemoryOAuthIdentities();
    authTokens = new InMemoryAuthToken();

    const restAuthenticator = new DefaultRestAuthenticator(
        players,
        credentials,
        identities,
        authTokens,
        new FakeGoogleVerifier()
    );

    app = new Elysia().use(
        authRoutes(restAuthenticator, authTokens)
    );
});