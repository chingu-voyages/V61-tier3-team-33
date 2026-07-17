// hooks/useRegister.ts

"use client";

import { useState } from "react";
import { register } from "@/lib/api";

import { useRouter } from "next/navigation";
export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(
    username: string,
    email: string,
    password: string
  ) {  console.log("Inside useRegister.submit");
    try {
      setLoading(true);
      setError("");
      console.log("Calling register API");
      await register({
        username,
        email,
        password,
      });
      router.replace("/play");

      console.log("Register API returned");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    submit,
  };
}