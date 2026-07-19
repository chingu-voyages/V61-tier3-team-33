"use client";

import { useEffect } from "react";

import { useAuth } from "../auth/use-auth";
import { useFriends } from "@/hooks/useFriends";

export function FriendsList() {
  const { user } = useAuth();

  const {
    friends,
    loading,
    loadFriends,
    removeFriend,
  } = useFriends();

  useEffect(() => {
    if (!user) return;

    loadFriends(user.playerId);
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="rounded-lg border p-6">
        <p>Loading friends...</p>
      </div>
    );
  }

  async function handleRemove(
    pidA: string,
    pidB: string
  ) {
    try {
      await removeFriend(pidA, pidB);

      // Refresh the list
      await loadFriends(user.playerId);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 text-xl font-semibold">
        Friends
      </h2>

      {friends.length === 0 ? (
        <p>No friends yet.</p>
      ) : (
        <div className="space-y-4">
          {friends.map((friend) => {
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

                <button
                  onClick={() =>
                    handleRemove(
                      friend.pidA,
                      friend.pidB
                    )
                  }
                  className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}