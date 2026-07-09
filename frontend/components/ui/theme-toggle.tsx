"use client"

import { IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative"
    >
      <IconSun className="absolute scale-100 rotate-0 text-amber-600 opacity-100 [transition:transform_0.25s_cubic-bezier(0.34,1.56,0.64,1),opacity_0.25s_cubic-bezier(0.34,1.56,0.64,1)] dark:scale-0 dark:-rotate-90 dark:opacity-0" />
      <IconMoon className="absolute scale-0 rotate-90 text-blue-400 opacity-0 [transition:transform_0.25s_cubic-bezier(0.34,1.56,0.64,1),opacity_0.25s_cubic-bezier(0.34,1.56,0.64,1)] dark:scale-100 dark:rotate-0 dark:opacity-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
