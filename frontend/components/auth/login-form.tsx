"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IconUser } from "@tabler/icons-react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { useAuth } from "@/components/auth/use-auth";
import { useGuest } from "@/context/guest/GuestProvider";
import { loginSchema } from "@/components/auth/auth-schemas";
import type { LoginForm } from "@/components/auth/auth-schemas";

type FieldErrors = Partial<Record<keyof LoginForm, string>>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { login } = useAuth();
  const { setGuest } = useGuest();
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({ login: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function updateField(field: keyof LoginForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});

    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginForm;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    login.submit(result.data.login, result.data.password);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Sign in to your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="login">Email or Username</FieldLabel>
          <Input
            id="login"
            type="text"
            placeholder="you@example.com"
            value={form.login}
            onChange={updateField("login")}
          />
          {fieldErrors.login && <FieldError>{fieldErrors.login}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="********"
            value={form.password}
            onChange={updateField("password")}
          />
          {fieldErrors.password && (
            <FieldError>{fieldErrors.password}</FieldError>
          )}
        </Field>
        <Field>
          <Button type="submit" disabled={login.loading}>
            {login.loading ? (
              <><Spinner /> Signing in...</>
            ) : (
              "Login"
            )}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <GoogleLoginButton />
          <button
            type="button"
            onClick={() => {
              setGuest();
              window.location.href = "/";
            }}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-4xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <IconUser className="size-4" />
            Continue as Guest
          </button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
