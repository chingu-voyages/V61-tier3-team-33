import { Elysia } from "elysia";

import { HttpGoogleTokenVerifier } from "../auth/google-token-verifier";
import { InMemoryAuthToken } from "../auth/in-memory-auth-token";
import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { authRoutes } from "../http/auth-routes";
import { InMemoryCredentials } from "../players/credential/in-memory-credentials";
import { InMemoryOAuthIdentities } from "../players/credential/Oauth/in-memory-oauth-identities";
import { InMemoryPlayers } from "../players/inMemortPlayers.class";

// Infrastructure
const players = new InMemoryPlayers();
const credentials = new InMemoryCredentials();
const identities = new InMemoryOAuthIdentities();
const authTokens = new InMemoryAuthToken();

// External services
const verifier = new HttpGoogleTokenVerifier(Bun.env.GOOGLE_CLIENT_ID ?? "");

const restAuthenticator = new DefaultRestAuthenticator(players, credentials, identities, authTokens, verifier);

// Application
export const app = new Elysia().use(authRoutes(restAuthenticator, authTokens));
