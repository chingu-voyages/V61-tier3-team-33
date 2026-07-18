import { logger as rootLogger } from "../../../logging/logger";
import type { Friend } from "../../types/friend";
import type { FriendError, Result } from "../../types/result";
import { err, ok } from "../../types/result";
import { ALREADY_EXISTS, CANNOT_FRIEND_SELF, FRIEND_NOT_FOUND } from "../../types/result";
import type { FriendStore } from "./friend-store";

const log = rootLogger.child({ module: "MemoryFriends" });

function key(pid1: string, pid2: string): string {
  const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];
  return `${a}:${b}`;
}

export class MemoryFriends implements FriendStore {
  private friends = new Map<string, Friend>();

  async findBetween(pid1: string, pid2: string): Promise<Result<Friend, typeof FRIEND_NOT_FOUND>> {
    const k = key(pid1, pid2);
    const f = this.friends.get(k);
    if (!f) {
      log.warn("[MemoryFriends.findBetween:not-found]", { pid1, pid2 });
      return err(FRIEND_NOT_FOUND);
    }
    return ok(f);
  }

  async save(friend: Friend): Promise<Result<void, typeof ALREADY_EXISTS | typeof CANNOT_FRIEND_SELF>> {
    const k = key(friend.pidA, friend.pidB);
    if (friend.pidA === friend.pidB) {
      return err(CANNOT_FRIEND_SELF);
    }
    if (this.friends.has(k)) {
      log.warn("[MemoryFriends.save:already-exists]", { pidA: friend.pidA, pidB: friend.pidB });
      return err(ALREADY_EXISTS);
    }
    this.friends.set(k, friend);
    log.info("[MemoryFriends.save:saved]", { pidA: friend.pidA, pidB: friend.pidB });
    return ok();
  }

  async accept(pid1: string, pid2: string): Promise<Result<void, typeof FRIEND_NOT_FOUND>> {
    const k = key(pid1, pid2);
    const f = this.friends.get(k);
    if (!f) {
      log.warn("[MemoryFriends.accept:not-found]", { pid1, pid2 });
      return err(FRIEND_NOT_FOUND);
    }
    f.status = "accepted";
    f.respondedAt = Date.now();
    log.info("[MemoryFriends.accept:accepted]", { pid1, pid2 });
    return ok();
  }

  async block(pid1: string, pid2: string): Promise<Result<void, never>> {
    const k = key(pid1, pid2);
    const existing = this.friends.get(k);
    if (existing) {
      existing.status = "blocked";
      existing.respondedAt = Date.now();
    } else {
      this.friends.set(k, {
        pidA: pid1 < pid2 ? pid1 : pid2,
        pidB: pid1 < pid2 ? pid2 : pid1,
        status: "blocked",
        requestedBy: pid1,
        createdAt: Date.now(),
        respondedAt: Date.now(),
      });
    }
    log.info("[MemoryFriends.block:blocked]", { blocker: pid1, blocked: pid2 });
    return ok();
  }

  async remove(pid1: string, pid2: string): Promise<Result<void, typeof FRIEND_NOT_FOUND>> {
    const k = key(pid1, pid2);
    if (!this.friends.has(k)) {
      log.warn("[MemoryFriends.remove:not-found]", { pid1, pid2 });
      return err(FRIEND_NOT_FOUND);
    }
    this.friends.delete(k);
    log.info("[MemoryFriends.remove:removed]", { pid1, pid2 });
    return ok();
  }

  async list(pid: string): Promise<Result<Friend[], FriendError>> {
    const result: Friend[] = [];
    for (const f of this.friends.values()) {
      if (f.status === "accepted" && (f.pidA === pid || f.pidB === pid)) {
        result.push(f);
      }
    }
    return ok(result);
  }

  async pending(pid: string): Promise<Result<Friend[], FriendError>> {
    const result: Friend[] = [];
    for (const f of this.friends.values()) {
      if (f.status === "pending" && (f.pidA === pid || f.pidB === pid)) {
        result.push(f);
      }
    }
    return ok(result);
  }
}
