import { MemoryPlayers } from "../player/memory";
import type { PlayerStore } from "../player/player-store";
import { MemoryOAuth } from "./memory";
import type { OAuthStore } from "./oauth-store";
import { testOAuthStore } from "./store-test";

function createStore(): { oauth: OAuthStore; players: PlayerStore } {
  const players = new MemoryPlayers();
  return { oauth: new MemoryOAuth(players), players };
}

testOAuthStore(createStore, "MemoryOAuth");
