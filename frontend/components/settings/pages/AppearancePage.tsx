"use client"

import { useTheme } from "next-themes"

import { useChessTheme } from "@/context/theme/ChessThemeProvider"
import { CHESS_THEMES } from "@/core/theme"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  IconChevronDown,
  IconDeviceLaptop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react"

const themeOptions = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "system", label: "System", icon: IconDeviceLaptop },
] as const

export function AppearancePage() {
  const { theme, setTheme } = useTheme()
  const { chessTheme: selectedChessTheme, setChessTheme } = useChessTheme()
  const current = themeOptions.find((o) => o.value === theme)!

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">
              Select your preferred color scheme.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="w-full sm:max-w-32">
                  <current.icon className="size-4" />
                  {current.label}
                  <IconChevronDown className="ml-auto size-4 opacity-50" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-32">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(v) => setTheme(v)}
              >
                {themeOptions.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    <option.icon className="size-4" />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Board theme</p>
          <p className="text-sm text-muted-foreground">
            Select your preferred board and piece colors.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CHESS_THEMES.map((chessTheme) => (
            <button
              key={chessTheme.id}
              type="button"
              onClick={() => setChessTheme(chessTheme.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-2 transition-colors",
                chessTheme.id === selectedChessTheme
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-accent"
              )}
            >
              <div
                data-chess-theme={chessTheme.id}
                className="grid h-12 w-12 grid-cols-2 grid-rows-2 overflow-hidden rounded-md"
              >
                <div className="bg-chess-light-square" />
                <div className="bg-chess-dark-square" />
                <div className="bg-chess-dark-square" />
                <div className="bg-chess-light-square" />
              </div>
              <span className="text-xs">{chessTheme.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
