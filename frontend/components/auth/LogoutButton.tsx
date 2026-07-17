"use client";

import { useLogout } from "@/hooks/useLogout";

export function LogoutButton() {
  const { loading, submit } = useLogout();

  return (
    <button
      onClick={submit}
      disabled={loading}
      className="
        rounded-lg
        bg-red-600
        px-4
        py-2
        text-white
        transition
        hover:bg-red-700
        disabled:opacity-50
      "
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}