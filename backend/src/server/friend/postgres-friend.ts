import sql from "../../db/postgres";
import { logger as rootLogger } from "../../logging/logger";
import { type Result, ok, err } from "../types/result";
import { 
  type FriendError, 
  FRIEND_NOT_FOUND, 
  ALREADY_EXISTS, 
  CANNOT_FRIEND_SELF, 
  INTERNAL_ERROR 
} from "../types/result";
import type { Friendship } from "./friendship";
import type { FriendStore } from "./friend-store";

const log = rootLogger.child({ module: "PostgresFriends" });

interface FriendRow {
  pid_a: string;
  pid_b: string;
  status: "pending" | "accepted" | "blocked";
  requested_by: string;
  created_at: Date;
  responded_at: Date | null;
}

export class PostgresFriends implements FriendStore {

  async findBetween(pid1: string, pid2: string): Promise<Result<Friendship, FriendError>> {
    if (pid1 === pid2) return err(CANNOT_FRIEND_SELF);
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      const [row] = await sql<FriendRow[]>`
        SELECT pid_a, pid_b, status, requested_by, created_at, responded_at
        FROM friends
        WHERE pid_a = ${a} AND pid_b = ${b};
      `;

      if (!row) return err(FRIEND_NOT_FOUND);

      return ok({
        pidA: row.pid_a,
        pidB: row.pid_b,
        status: row.status,
        requestedBy: row.requested_by,
        createdAt: row.created_at.getTime(),
        respondedAt: row.responded_at?.getTime() ?? undefined,
      });
    } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
      
        log.error("[PostgresFriends.findBetween:failed]", {
          message: error.message,
          stack: error.stack,
        });
      
        return err(INTERNAL_ERROR);
      }
  }

  async save(friendship: Friendship): Promise<Result<void, FriendError>> {
    try {
      // The Postgres trigger automatically checks ordering, but let's be canonical 
      const [a, b] = friendship.pidA < friendship.pidB 
        ? [friendship.pidA, friendship.pidB] 
        : [friendship.pidB, friendship.pidA];

      await sql`
        INSERT INTO friends (pid_a, pid_b, status, requested_by, created_at)
        VALUES (${a}, ${b}, ${friendship.status}::friend_status, ${friendship.requestedBy}, to_timestamp(${friendship.createdAt} / 1000.0))
        ON CONFLICT (pid_a, pid_b) DO NOTHING;
      `;

      log.info("[PostgresFriends.save:created]", { a, b });
      return ok();
    } catch (e: any) {
      if (e.code === "23505") return err(ALREADY_EXISTS); // Unique violation safety check
      log.error("[PostgresFriends.save:failed]", e);
      return err(INTERNAL_ERROR);
    }
  }

  async accept(pid1: string, pid2: string): Promise<Result<void, FriendError>> {
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      const result = await sql`
        UPDATE friends
        SET status = 'accepted'::friend_status, responded_at = NOW()
        WHERE pid_a = ${a} AND pid_b = ${b} AND status = 'pending'::friend_status;
      `;

      if (result.count === 0) return err(FRIEND_NOT_FOUND);

      log.info("[PostgresFriends.accept:success]", { a, b });
      return ok();
    } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
      
        log.error("[PostgresFriends.findBetween:failed]", {
          message: error.message,
          stack: error.stack,
        });
      
        return err(INTERNAL_ERROR);
      }
  }

  async block(pid1: string, pid2: string): Promise<Result<void, FriendError>> {
    const [a, b] = pid1 < pid2 ? [pid1, pid2] : [pid2, pid1];

    try {
      // Create relationship as blocked, or overwrite status to blocked if a row already exists
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
      
        log.error("[PostgresFriends.findBetween:failed]", {
          message: error.message,
          stack: error.stack,
        });
      
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
      
        log.error("[PostgresFriends.findBetween:failed]", {
          message: error.message,
          stack: error.stack,
        });
      
        return err(INTERNAL_ERROR);
      }
  }

  async list(pid: string): Promise<Result<Friendship[], never>> {
    try {
      const rows = await sql<FriendRow[]>`
        SELECT pid_a, pid_b, status, requested_by, created_at, responded_at
        FROM friends
        WHERE status = 'accepted' AND (pid_a = ${pid} OR pid_b = ${pid});
      `;

      const friendships = rows.map(row => ({
        pidA: row.pid_a,
        pidB: row.pid_b,
        status: row.status,
        requestedBy: row.requested_by,
        createdAt: row.created_at.getTime(),
        respondedAt: row.responded_at?.getTime() ?? undefined,
      }));

      return ok(friendships);
    } catch (e) {
      log.error("[PostgresFriends.list:failed]", {e});
      return ok([]); // Return an empty array match matching the `never` error type constraint
    }
  }

  async pending(pid: string): Promise<Result<Friendship[], never>> {
    try {
      const rows = await sql<FriendRow[]>`
        SELECT pid_a, pid_b, status, requested_by, created_at, responded_at
        FROM friends
        WHERE status = 'pending' AND (pid_a = ${pid} OR pid_b = ${pid});
      `;

      const friendships = rows.map(row => ({
        pidA: row.pid_a,
        pidB: row.pid_b,
        status: row.status,
        requestedBy: row.requested_by,
        createdAt: row.created_at.getTime(),
        respondedAt: row.responded_at?.getTime() ?? undefined,
      }));

      return ok(friendships);
    } catch (e) {
      log.error("[PostgresFriends.pending:failed]",{ e});
      return ok([]);
    }
  }
}