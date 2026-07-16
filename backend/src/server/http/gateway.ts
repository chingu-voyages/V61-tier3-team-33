import { Elysia } from "elysia";

import { HttpGoogleTokenVerifier } from "../auth/google-token-verifier";
import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { authRoutes } from "../http/auth-routes";
import { MemoryCredentials } from "../store/credential/memory";
import { MemoryOAuth } from "../store/oauth/memory";
import { MemoryPlayers } from "../store/player/memory";
import { MemoryTokens } from "../store/token/memory";

// Infrastructure
const players = new MemoryPlayers();
const credentials = new MemoryCredentials(players);
const identities = new MemoryOAuth(players);
const authTokens = new MemoryTokens(players);

// External services
const verifier = new HttpGoogleTokenVerifier(Bun.env.GOOGLE_CLIENT_ID ?? "");

const restAuthenticator = new DefaultRestAuthenticator(players, credentials, identities, authTokens, verifier);

// Application
export const app = new Elysia().use(authRoutes(restAuthenticator, authTokens));
