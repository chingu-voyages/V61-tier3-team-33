import { MemoryPlayers } from "../player/memory";
import type { PlayerStore } from "../player/player-store";
import { MemoryTokens } from "./memory";
import { testTokenStore } from "./store-test";
import type { TokenStore } from "./token-store";

function createStore(): { tokens: TokenStore; players: PlayerStore } {
  const players = new MemoryPlayers();
  return { tokens: new MemoryTokens(players), players };
}

testTokenStore(createStore, "MemoryTokens");
