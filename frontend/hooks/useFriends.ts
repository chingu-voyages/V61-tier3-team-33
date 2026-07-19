"use client";

import { useCallback, useState } from "react";
import * as api from "@/lib/friend";
import type { Friendship } from "@/types/friend";

export function useFriends() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pending, setPending] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFriends = useCallback(async (pid: string) => {
    setLoading(true);

    try {
      const friends = await api.getFriends(pid);
      setFriends(friends);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPending = useCallback(async (pid: string) => {
    try {
      const requests = await api.getPending(pid);
      setPending(requests);
    } catch (err) {
      console.error(err);
    }
  }, []);

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