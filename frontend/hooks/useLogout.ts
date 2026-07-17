"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/api";

export function useLogout() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);

      await logout();

      router.replace("/");

    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    submit,
  };
}