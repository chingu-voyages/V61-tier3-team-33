import { MemoryPlayers } from "../player/memory";
import type { PlayerStore } from "../player/player-store";
import type { CredentialStore } from "./credential-store";
import { MemoryCredentials } from "./memory";
import { testCredentialStore } from "./store-test";

function createStore(): { creds: CredentialStore; players: PlayerStore } {
  const players = new MemoryPlayers();
  return { creds: new MemoryCredentials(players), players };
}

testCredentialStore(createStore, "MemoryCredentials");
