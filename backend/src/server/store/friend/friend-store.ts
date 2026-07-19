import type { Friend } from "../../types/friend";
import type { Result } from "../../types/result";
import type { FriendError } from "../../types/result";
import type { StoreKind } from "../../types/store";
import { MEMORY, POSTGRES } from "../../types/store";
import { MemoryFriends } from "./memory";
import { PostgresFriends } from "./postgres";

export interface FriendStore {
  findBetween(pid1: string, pid2: string): Promise<Result<Friend, FriendError>>;
  save(friend: Friend): Promise<Result<void, FriendError>>;
  accept(pid1: string, pid2: string): Promise<Result<void, FriendError>>;
  block(pid1: string, pid2: string): Promise<Result<void, FriendError>>;
  remove(pid1: string, pid2: string): Promise<Result<void, FriendError>>;
  list(pid: string): Promise<Result<Friend[], FriendError>>;
  pending(pid: string): Promise<Result<Friend[], FriendError>>;
}

export function createFriendStore(kind: StoreKind): FriendStore {
  switch (kind) {
    case MEMORY:
      return new MemoryFriends();
    case POSTGRES:
      return new PostgresFriends();
  }
  throw new Error(`Unknown store kind: ${kind}`);
}

export type { FriendError };
