import { GoogleButton } from "./GoogleButton";
import { LoginForm } from "./LoginForm";

export function LoginCard() {
  return (
    <div className="w-full max-w-md rounded-xl border p-8 shadow-lg">
      <h1 className="text-3xl font-bold">
        Welcome Back
      </h1>

      <p className="mt-2 text-muted-foreground">
        Sign in to continue.
      </p>

      <div className="mt-6">
        <GoogleButton />
      </div>

      <div className="my-6 flex items-center">
        <div className="flex-1 border-t" />

        <span className="mx-4 text-sm text-muted-foreground">
          OR
        </span>

        <div className="flex-1 border-t" />
      </div>

      <LoginForm />
    </div>
  );
}