import { sql } from "../../../db/postgres";
import { logger as rootLogger } from "../../../logging/logger";
import type { Friend, FriendRow } from "../../types/friend";
import { Friend as FriendMapper } from "../../types/friend";
import type { FriendError } from "../../types/result";
import { err, ok, type Result } from "../../types/result";
import { ALREADY_EXISTS, CANNOT_FRIEND_SELF, FRIEND_NOT_FOUND, INTERNAL_ERROR } from "../../types/result";
import type { FriendStore } from "./friend-store";

const log = rootLogger.child({ module: "PostgresFriends" });

export class PostgresFriends implements FriendStore {
  async findBetween(pid1: string, pid2: string): Promise<Result<Friend, FriendError>> {
    if (pid1 === pid2) return err(CANNOT_FRIEND_SELF);
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      const [row] = await sql<FriendRow[]>`
        SELECT pid_a, pid_b, status, requested_by, created_at, responded_at
        FROM friends
        WHERE pid_a = ${a} AND pid_b = ${b};
      `;

      if (!row) return err(FRIEND_NOT_FOUND);

      return ok(FriendMapper.fromRow(row));
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));

      log.error("[PostgresFriends.findBetween:failed]", {
        message: error.message,
        stack: error.stack,
      });

      return err(INTERNAL_ERROR);
    }
  }

  async save(friend: Friend): Promise<Result<void, FriendError>> {
    if (friend.pidA === friend.pidB) return err(CANNOT_FRIEND_SELF);

    try {
      const [a, b] = friend.pidA < friend.pidB ? [friend.pidA, friend.pidB] : [friend.pidB, friend.pidA];

      const result = await sql`
        INSERT INTO friends (pid_a, pid_b, status, requested_by, created_at)
        VALUES (${a}, ${b}, ${friend.status}::friend_status, ${friend.requestedBy}, to_timestamp(${friend.createdAt} / 1000.0))
        ON CONFLICT (pid_a, pid_b) DO NOTHING;
      `;

      if (result.count === 0) {
        log.warn("[PostgresFriends.save:already-exists]", { a, b });
        return err(ALREADY_EXISTS);
      }

      log.info("[PostgresFriends.save:created]", { a, b });
      return ok();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresFriends.save:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }

  async accept(pid1: string, pid2: string): Promise<Result<void, FriendError>> {
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      const result = await sql`
        UPDATE friends
        SET status = 'accepted'::friend_status, responded_at = NOW()
        WHERE pid_a = ${a} AND pid_b = ${b};
      `;

      if (result.count === 0) return err(FRIEND_NOT_FOUND);

      log.info("[PostgresFriends.accept:success]", { a, b });
      return ok();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresFriends.accept:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }

  async block(pid1: string, pid2: string): Promise<Result<void, FriendError>> {
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      await sql`
        INSERT INTO friends (pid_a, pid_b, status, requested_by, created_at, responded_at)
        VALUES (${a}, ${b}, 'blocked'::friend_status, ${pid1}, NOW(), NOW())
        ON CONFLICT (pid_a, pid_b)
        DO UPDATE SET status = 'blocked'::friend_status, responded_at = NOW();
      `;

      log.info("[PostgresFriends.block:success]", { blocker: pid1, blocked: pid2 });
      return ok();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresFriends.block:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }

  async remove(pid1: string, pid2: string): Promise<Result<void, FriendError>> {
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      const result = await sql`
        DELETE FROM friends
        WHERE pid_a = ${a} AND pid_b = ${b};
      `;

      if (result.count === 0) return err(FRIEND_NOT_FOUND);

      log.info("[PostgresFriends.remove:success]", { a, b });
      return ok();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresFriends.remove:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }

  async list(pid: string): Promise<Result<Friend[], FriendError>> {
    try {
      const rows = await sql<FriendRow[]>`
        SELECT pid_a, pid_b, status, requested_by, created_at, responded_at
        FROM friends
        WHERE status = 'accepted' AND (pid_a = ${pid} OR pid_b = ${pid});
      `;

      return ok(rows.map(FriendMapper.fromRow));
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresFriends.list:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }

  async pending(pid: string): Promise<Result<Friend[], FriendError>> {
    try {
      const rows = await sql<FriendRow[]>`
        SELECT pid_a, pid_b, status, requested_by, created_at, responded_at
        FROM friends
        WHERE status = 'pending' AND (pid_a = ${pid} OR pid_b = ${pid});
      `;

      return ok(rows.map(FriendMapper.fromRow));
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      log.error("[PostgresFriends.pending:failed]", { message: error.message });
      return err(INTERNAL_ERROR);
    }
  }
}
