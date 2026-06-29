"use client"

import { motion } from "motion/react"
import { IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative"
    >
      <motion.span
        className="absolute flex"
        animate={{
          scale: isDark ? 1 : 0,
          rotate: isDark ? 0 : -90,
          opacity: isDark ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <IconMoon className="text-blue-400" />
      </motion.span>
      <motion.span
        className="flex"
        animate={{
          scale: isDark ? 0 : 1,
          rotate: isDark ? 90 : 0,
          opacity: isDark ? 0 : 1,
        }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <IconSun className="text-amber-600" />
      </motion.span>
    </Button>
  )
}
