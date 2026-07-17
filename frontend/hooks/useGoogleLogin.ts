"use client";

import { useState } from "react";
import { googleLogin } from "@/lib/api";

export function useGoogleLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(idToken: string) {
    try {
      setLoading(true);
      setError("");

      const player = await googleLogin(idToken);

      console.log(player);

      // later:
      // router.push("/play")

    } catch (err) {
      setError("Google Login Failed");
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    login,
  };
}