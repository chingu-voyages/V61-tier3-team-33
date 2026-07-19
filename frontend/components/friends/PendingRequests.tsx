"use client";

import { useEffect, useState } from "react";

import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "../auth/use-auth";

export function PendingRequests() {
  const { user, loading } = useAuth();

  const {
    pending,
    loadPending,
    acceptRequest,
    blockFriend,
  } = useFriends();

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadPending(user.playerId);
    }
  }, [user]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return null;
  }

  async function handleAccept(friend: (typeof pending)[number]) {
    try {
      setActionLoading(true);

      await acceptRequest(friend.pidA, friend.pidB);

      await loadPending(user.playerId);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBlock(friend: (typeof pending)[number]) {
    try {
      setActionLoading(true);

      await blockFriend(friend.pidA, friend.pidB);

      await loadPending(user.playerId);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 text-xl font-semibold">
        Pending Requests
      </h2>

      {pending.length === 0 && (
        <p>No pending requests.</p>
      )}

      <div className="space-y-4">
        {pending.map((friend) => {
          const other =
            friend.pidA === user.playerId
              ? friend.pidB
              : friend.pidA;

          return (
            <div
              key={`${friend.pidA}-${friend.pidB}`}
              className="flex items-center justify-between rounded border p-3"
            >
              <span>{other}</span>

              <div className="space-x-2">
                <button
                  disabled={actionLoading}
                  onClick={() => handleAccept(friend)}
                  className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  Accept
                </button>

                <button
                  disabled={actionLoading}
                  onClick={() => handleBlock(friend)}
                  className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  Block
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}