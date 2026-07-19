"use client";

import { useState } from "react";

import { useAuth } from "../auth/use-auth";
import { useFriends } from "@/hooks/useFriends";

export function FriendSearch() {
  const { user } = useAuth();

  const { sendRequest } = useFriends();

  const [playerId, setPlayerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSend() {
    if (!user) return;

    if (!playerId.trim()) {
      setMessage("Enter a player ID.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await sendRequest(user.playerId, playerId);

      setMessage("Friend request sent.");
      setPlayerId("");
    } catch (e) {
      if (e instanceof Error) {
        setMessage(e.message);
      } else {
        setMessage("Failed to send request.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-6">
      <h2 className="text-xl font-semibold">
        Add Friend
      </h2>

      <input
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        placeholder="Player ID"
        className="w-full rounded border p-2"
      />

      <button
        onClick={handleSend}
        disabled={loading || !user}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send Request"}
      </button>

      {message && (
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}