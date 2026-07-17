// app/register/page.tsx

import { RegisterCard } from "@/components/auth/RegisterCard";

export default function RegisterPage() {
  return (
    <main
      className="
      flex
      min-h-screen
      items-center
      justify-center
      bg-neutral-800
      px-4
      "
    >
      <RegisterCard />
    </main>
  );
}