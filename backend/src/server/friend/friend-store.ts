import type { Result } from "../types/result";
import type { Friendship } from "./friendship";
import type { FriendError } from "../types";

export interface FriendStore {
  findBetween(
    pid1: string,
    pid2: string,
  ): Promise<Result<Friendship, FriendError>>;

  save(
    friendship: Friendship,
  ): Promise<Result<void, FriendError>>;

  accept(
    pid1: string,
    pid2: string,
  ): Promise<Result<void, FriendError>>;

  block(
    pid1: string,
    pid2: string,
  ): Promise<Result<void, FriendError>>;

  remove(
    pid1: string,
    pid2: string,
  ): Promise<Result<void, FriendError>>;

  list(
    pid: string,
  ): Promise<Result<Friendship[], never>>;

  pending(
    pid: string,
  ): Promise<Result<Friendship[], never>>;
}
import { POSTGRES } from "../types/store";
import type { StoreKind } from "../types/store";
import { PostgresFriends } from "./postgres-friend";

export function createFriendStore(kind: StoreKind): FriendStore {
  switch (kind) {
    case POSTGRES:
      return new PostgresFriends();

    default:
      throw new Error(`Unsupported store: ${kind}`);
  }
}