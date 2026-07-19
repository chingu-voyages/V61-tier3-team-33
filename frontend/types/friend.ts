export interface Friendship {
    pidA: string;
    pidB: string;
    requestedBy: string;
    status: "pending" | "accepted" | "blocked";
    createdAt: number;
    respondedAt?: number;
  }