import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"
import { IconLayoutRows } from "@tabler/icons-react"

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <Link href="/" className="flex items-center gap-2 font-medium">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <IconLayoutRows className="size-4" />
        </div>
        Chingu Chess
      </Link>
      <div className="w-full max-w-xs">
        <RegisterForm />
      </div>
    </div>
  )
}
