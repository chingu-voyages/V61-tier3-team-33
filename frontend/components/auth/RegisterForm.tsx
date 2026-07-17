"use client";

import { useState } from "react";

import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthInput } from "./AuthInput";

import { useRegister } from "@/hooks/useRegister";
import { validateRegister } from "@/utils/validators";

export function RegisterForm() {
  const { loading, error, submit } = useRegister();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    console.log("Submitting register form");
    const validation = validateRegister(
      username,
      email,
      password
    );

    if (validation) {
      return;
    }

    await submit(username, email, password);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AuthInput
        id="username"
        label="Username"
        type="text"
        value={username}
        placeholder="Kartik"
        onChange={setUsername}
      />

      <AuthInput
        id="email"
        label="Email"
        type="email"
        value={email}
        placeholder="you@example.com"
        onChange={setEmail}
      />

      <AuthInput
        id="password"
        label="Password"
        type="password"
        value={password}
        placeholder="********"
        onChange={setPassword}
      />

      <AuthError error={error} />

      <AuthButton
        loading={loading}
        text="Create Account"
        loadingText="Creating Account..."
      />
    </form>
  );
}