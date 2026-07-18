export type FriendStatus = "pending" | "accepted" | "blocked";

export interface FriendRow {
  pid_a: string;
  pid_b: string;
  status: FriendStatus;
  requested_by: string;
  created_at: Date;
  responded_at: Date | null;
}

export interface Friendship {
  pidA: string;
  pidB: string;

  status: FriendStatus;

  requestedBy: string;

  createdAt: number;
  respondedAt?: number;
}

export const Friendship = {
  create(requester: string, receiver: string): Friendship {
    const [pidA, pidB] =
      requester < receiver
        ? [requester, receiver]
        : [receiver, requester];

    return {
      pidA,
      pidB,
      status: "pending",
      requestedBy: requester,
      createdAt: Date.now(),
    };
  },

  fromRow(row: FriendRow): Friendship {
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