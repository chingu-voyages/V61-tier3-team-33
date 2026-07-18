import type{ FriendStore } from "./friend-store";
import { Friendship } from "./friendship";
import type { PlayerStore } from "../store/player/player-store";
import type { Result, FriendError } from "../types/result";

import {
  ok,
  err,
  FRIEND_NOT_FOUND,
  ALREADY_EXISTS,
  CANNOT_FRIEND_SELF,
} from "../types/result";

export interface FriendService {
    sendRequest(
        from: string,
        to: string,
    ): Promise<Result<void, FriendError>>;

    acceptRequest(
        from: string,
        to: string,
    ): Promise<Result<void, FriendError>>;

    block(
        from: string,
        to: string,
    ): Promise<Result<void, FriendError>>;

    remove(
        from: string,
        to: string,
    ): Promise<Result<void, FriendError>>;

    listFriends(
        pid: string,
    ): Promise<Result<Friendship[], never>>;

    pendingRequests(
        pid: string,
    ): Promise<Result<Friendship[], never>>;
}

export class DefaultFriendService implements FriendService {
    constructor(
        private friends: FriendStore,
        private players: PlayerStore,
    ) {}

    async sendRequest(
        from: string,
        to: string,
    ): Promise<Result<void, FriendError>> {

        if (from === to)
            return err(CANNOT_FRIEND_SELF);

        const sender = await this.players.findById(from);
        if (!sender.ok)
            return err(FRIEND_NOT_FOUND);

        const receiver = await this.players.findById(to);
        if (!receiver.ok)
            return err(FRIEND_NOT_FOUND);

        const existing = await this.friends.findBetween(from, to);

        if (existing.ok)
            return err(ALREADY_EXISTS);

        return this.friends.save({
            pidA: from,
            pidB: to,
            status: "pending",
            requestedBy: from,
            createdAt: Date.now(),
        });
    }

    async acceptRequest(
        from: string,
        to: string,
    ) {
        return this.friends.accept(from, to);
    }

    async block(
        from: string,
        to: string,
    ) {
        return this.friends.block(from, to);
    }

    async remove(
        from: string,
        to: string,
    ) {
        return this.friends.remove(from, to);
    }

    async listFriends(
        pid: string,
    ) {
        return this.friends.list(pid);
    }

    async pendingRequests(
        pid: string,
    ) {
        return this.friends.pending(pid);
    }
}