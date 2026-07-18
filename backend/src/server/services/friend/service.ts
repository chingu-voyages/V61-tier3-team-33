import { logger as rootLogger } from "../../../logging/logger";
import type { FriendStore } from "../../store/friend/friend-store";
import type { PlayerStore } from "../../store/player/player-store";
import { Friend } from "../../types/friend";
import type { FriendError, Result } from "../../types/result";
import { err, ok } from "../../types/result";
import { ALREADY_EXISTS, CANNOT_FRIEND_SELF, FRIEND_NOT_FOUND, INTERNAL_ERROR } from "../../types/result";

const log = rootLogger.child({ module: "FriendService" });

export class FriendService {
  constructor(
    private friends: FriendStore,
    private players: PlayerStore,
  ) {}

  async sendRequest(from: string, to: string): Promise<Result<void, FriendError>> {
    if (from === to) {
      log.warn("[FriendService.sendRequest:self-friend]", { playerId: from });
      return err(CANNOT_FRIEND_SELF);
    }

    const sender = await this.players.findById(from);
    if (!sender.ok) {
      log.warn("[FriendService.sendRequest:sender-not-found]", { playerId: from });
      return err(FRIEND_NOT_FOUND);
    }

    const receiver = await this.players.findById(to);
    if (!receiver.ok) {
      log.warn("[FriendService.sendRequest:receiver-not-found]", { playerId: to });
      return err(FRIEND_NOT_FOUND);
    }

    const existing = await this.friends.findBetween(from, to);
    if (existing.ok) {
      log.warn("[FriendService.sendRequest:already-exists]", { from, to });
      return err(ALREADY_EXISTS);
    }
    if (existing.error !== FRIEND_NOT_FOUND) {
      log.error("[FriendService.sendRequest:find-failed]", { from, to, error: existing.error });
      return err(INTERNAL_ERROR);
    }

    const friendship = Friend.create(from, to);
    log.info("[FriendService.sendRequest:sent]", { from, to });
    return this.friends.save(friendship);
  }

  async acceptRequest(from: string, to: string): Promise<Result<void, FriendError>> {
    if (from === to) return err(CANNOT_FRIEND_SELF);

    const existing = await this.friends.findBetween(from, to);
    if (!existing.ok) {
      if (existing.error === FRIEND_NOT_FOUND) {
        log.warn("[FriendService.acceptRequest:not-found]", { from, to });
        return err(FRIEND_NOT_FOUND);
      }
      return err(INTERNAL_ERROR);
    }

    const friendship = existing.value;
    if (friendship.requestedBy === from) {
      log.warn("[FriendService.acceptRequest:self-accept]", { from, to });
      return err(FRIEND_NOT_FOUND);
    }

    if (friendship.status === "accepted") {
      log.warn("[FriendService.acceptRequest:already-accepted]", { from, to });
      return ok();
    }

    log.info("[FriendService.acceptRequest:accepting]", { from, to });
    return this.friends.accept(from, to);
  }

  async block(from: string, to: string): Promise<Result<void, FriendError>> {
    log.info("[FriendService.block:blocking]", { blocker: from, blocked: to });
    return this.friends.block(from, to);
  }

  async remove(from: string, to: string): Promise<Result<void, FriendError>> {
    log.info("[FriendService.remove:removing]", { from, to });
    return this.friends.remove(from, to);
  }

  async listFriends(pid: string): Promise<Result<Friend[], FriendError>> {
    return this.friends.list(pid);
  }

  async pendingRequests(pid: string): Promise<Result<Friend[], FriendError>> {
    return this.friends.pending(pid);
  }
}
