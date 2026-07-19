import { z } from "zod";

export type FriendStatus = "pending" | "accepted" | "blocked";

/** Raw row from the `friends` table. */
export interface FriendRow {
  pid_a: string;
  pid_b: string;
  status: FriendStatus;
  requested_by: string;
  created_at: Date;
  responded_at: Date | null;
}

/** Domain friend — symmetric relation stored in canonical order (pidA < pidB). */
export interface Friend {
  pidA: string;
  pidB: string;
  status: FriendStatus;
  requestedBy: string;
  createdAt: number;
  respondedAt?: number;
}

export const Friend = {
  create(requester: string, receiver: string): Friend {
    const [pidA, pidB] = requester < receiver ? [requester, receiver] : [receiver, requester];

    return {
      pidA,
      pidB,
      status: "pending",
      requestedBy: requester,
      createdAt: Date.now(),
    };
  },

  fromRow(row: FriendRow): Friend {
    return {
      pidA: row.pid_a,
      pidB: row.pid_b,
      status: row.status,
      requestedBy: row.requested_by,
      createdAt: row.created_at.getTime(),
      respondedAt: row.responded_at?.getTime(),
    };
  },
};

export const friendRequestSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
