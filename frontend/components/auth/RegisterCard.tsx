import { GoogleButton } from "./GoogleButton";
import { RegisterForm } from "./RegisterForm";
import Link from "next/link";
export function RegisterCard() {
  return (
    <div
      className="
        w-full
        max-w-md
        rounded-xl
        border
        p-8
        shadow-lg
      "
    >
      <h1 className="text-3xl font-bold">
        Create Account
      </h1>

      <p className="mt-2 text-muted-foreground">
        Register to start playing.
      </p>

      <div className="mt-8">
        <GoogleButton />
      </div>

      <div className="my-6 flex items-center">
        <div className="flex-1 border-t border-neutral-300" />

        <span className="mx-4 text-sm text-muted-foreground">
          OR
        </span>

        <div className="flex-1 border-t border-neutral-300" />
      </div>

      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
      <Link
          href="/register"
          className="font-medium text-blue-600 hover:underline"
        >
          Login
        </Link></p>
    </div>
  );
}