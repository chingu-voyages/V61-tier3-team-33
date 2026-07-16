import { MemoryPlayers } from "./memory";
import type { PlayerStore } from "./player-store";
import { testPlayerStore } from "./store-test";

function makeStore(): PlayerStore {
  return new MemoryPlayers();
}

testPlayerStore(makeStore, "MemoryPlayers");
