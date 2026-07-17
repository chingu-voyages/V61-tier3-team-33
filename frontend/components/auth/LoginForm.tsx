"use client";

import { useState } from "react";

import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthInput } from "./AuthInput";

import { useLogin } from "@/hooks/useLogin";
import { validateLogin } from "@/utils/validators";

export function LoginForm() {
  const { loading, error, submit } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const validationError = validateLogin(email, password);

    if (validationError) return;

    await submit(email, password);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
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
        text="Login"
        loadingText="Signing In..."
      />
    </form>
  );
}