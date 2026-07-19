import { GoogleIcon } from "@/components/icons/google"
import { env } from "@/config/env"

export function GoogleLoginButton() {
  return (
    <a
      href={`${env.apiUrl}/auth/google/redirect`}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-4xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      <GoogleIcon className="size-4" />
      Continue with Google
    </a>
  )
}
