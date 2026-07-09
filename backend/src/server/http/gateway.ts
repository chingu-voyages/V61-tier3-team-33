import { Elysia } from "elysia";

import { Sessions } from "../session/sessions";
import { InMemoryPlayers } from "../players/inMemortPlayers.class";
import { InMemoryCredentials } from "../players/credential/in-memory-credentials";
import { InMemoryOAuthIdentities } from "../players/credential/Oauth/in-memory-oauth-identities";
import { InMemoryAuthToken } from "../auth/in-memory-auth-token";

import { GuestAuthenticator } from "../auth/authenticator";
import { DefaultRestAuthenticator } from "../auth/rest-authenticator";
import { HttpGoogleTokenVerifier } from "../auth/google-token-verifier";

import { authRoutes } from "../http/auth-routes";
import { websocketRoutes } from "../ws/websocket-routes"; // whatever yours is called

// Infrastructure
const players = new InMemoryPlayers();
const credentials = new InMemoryCredentials();
const identities = new InMemoryOAuthIdentities();
const authTokens = new InMemoryAuthToken();
const sessions = new Sessions();

// External services
const verifier = new HttpGoogleTokenVerifier(
  Bun.env.GOOGLE_CLIENT_ID ?? ""
);

// Business services
const guestAuthenticator = new GuestAuthenticator(
  sessions,
  players,
  authTokens
);

const restAuthenticator = new DefaultRestAuthenticator(
  players,
  credentials,
  identities,
  authTokens,
  verifier
);

// Application
export const app = new Elysia()
  .use(authRoutes(restAuthenticator, authTokens))
  .use(websocketRoutes(guestAuthenticator));