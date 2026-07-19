"use client";

import { useState } from "react";
import * as api from "@/lib/friend";
import type { Friendship } from "@/types/friend";

export function useFriends() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pending, setPending] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadFriends(pid: string) {
    setLoading(true);

    try {
      const friends = await api.getFriends(pid);
      setFriends(friends);
    } finally {
      setLoading(false);
    }
  }

  async function loadPending(pid: string) {
    try {
      const requests = await api.getPending(pid);
      setPending(requests);
    } catch (err) {
      console.error(err);
    }
  }

  return {
    friends,
    pending,
    loading,
    loadFriends,
    loadPending,
    sendRequest: api.sendRequest,
    acceptRequest: api.acceptRequest,
    blockFriend: api.blockFriend,
    removeFriend: api.removeFriend,
  };
}