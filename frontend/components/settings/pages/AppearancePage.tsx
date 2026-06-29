"use client"

import { useTheme } from "next-themes"

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
                <Button variant="outline" className="w-full sm:min-w-32">
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
    </div>
  )
}
