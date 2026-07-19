import type { FriendStore } from "./friend-store";
import { MemoryFriends } from "./memory";
import { testFriendStore } from "./store-test";

function createStore(): FriendStore {
  return new MemoryFriends();
}

testFriendStore(createStore, "MemoryFriends");
