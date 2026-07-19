"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { useGuest } from "@/context/guest/GuestProvider";
import { env } from "@/config/env";

interface LoginRequest {
  login: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

async function login(data: LoginRequest) {
  const res = await fetch(`${env.apiUrl}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function register(data: RegisterRequest) {
  const res = await fetch(`${env.apiUrl}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function logout() {
  const res = await fetch(`${env.apiUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Logout failed");
}

async function getCurrentUser() {
  const res = await fetch(`${env.apiUrl}/auth/me`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { clearGuest } = useGuest();

  const session = useQuery({
    queryKey: ["session"],
    queryFn: getCurrentUser,
    retry: false,
  });

  function setSessionCookie() {
    document.cookie = "session=true; path=/; sameSite=lax; max-age=86400";
  }

  function clearSessionCookie() {
    document.cookie = "session=; path=/; sameSite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(["session"], data);
      setSessionCookie();
      clearGuest();
      setTimeout(() => router.replace("/"), 0);
    },
    onError: (err) => {
      gooeyToast.error(err.message);
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      queryClient.setQueryData(["session"], data);
      setSessionCookie();
      clearGuest();
      setTimeout(() => router.replace("/"), 0);
    },
    onError: (err) => {
      gooeyToast.error(err.message);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
      clearSessionCookie();
      setTimeout(() => router.replace("/login"), 0);
    },
  });

  return {
    user: session.data ?? null,
    loading: session.isLoading,
    login: {
      submit: (login: string, password: string) =>
        loginMutation.mutate({ login, password }),
      loading: loginMutation.isPending,
    },
    register: {
      submit: (username: string, email: string, password: string) =>
        registerMutation.mutate({ username, email, password }),
      loading: registerMutation.isPending,
    },
    logout: {
      submit: () => logoutMutation.mutate(),
      loading: logoutMutation.isPending,
    },
  };
}
