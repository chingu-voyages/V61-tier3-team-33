// lib/api.ts

import type {
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
  } from "@/types/auth";
  
  const API = process.env.NEXT_PUBLIC_API_URL;
  
  export async function login(
    data: LoginRequest
  ): Promise<LoginResponse> {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  
    if (!res.ok) {
      throw new Error((await res.json()).error);
    }
  
    return res.json();
  }
  
  export async function register(
    data: RegisterRequest
  ): Promise<RegisterResponse> {  console.log("API URL:", API);
    console.log("Sending request...");
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    console.log("Status:", res.status);
    if (!res.ok) {
      throw new Error((await res.json()).error);
    }
  
    return res.json();
  }


  export async function googleLogin(idToken: string) {
    const response = await fetch(
      `${API}/auth/google`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
        }),
      }
    );
  
    if (!response.ok) {
      throw new Error(await response.text());
    }
  
    return response.json();
  }
  export async function logout(): Promise<void> {
    const res = await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  
    if (!res.ok) {
      throw new Error("Logout failed");
    }
  }

  export async function getCurrentUser() {
    const res = await fetch(`${API}/auth/me`, {
      credentials: "include",
    });
  
    if (!res.ok) {
      return null;
    }
  
    return res.json();
  }