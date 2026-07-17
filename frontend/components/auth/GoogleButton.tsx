"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useGoogleLogin } from "@/hooks/useGoogleLogin";

export function GoogleButton() {
  const { login } = useGoogleLogin();

  return (
    <GoogleLogin
      onSuccess={(response) => {
        if (!response.credential) return;

        login(response.credential);
      }}
      onError={() => {
        console.error("Google Login Failed");
      }}
    />
  );
}