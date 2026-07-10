"use client"

import { IconArrowLeft, IconChevronRight, IconSearch } from "@tabler/icons-react"
import { SheetClose } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { settingsSections } from "@/components/settings/settings-sections"
import { useSettingsContext } from "@/context/settings/settings-context"

export function MobileList() {
  const { goToSection } = useSettingsContext()

  return (
    <div className="contents">
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <SheetClose render={<Button variant="ghost" size="icon" />}>
          <IconArrowLeft />
        </SheetClose>
        <span className="font-heading text-base font-medium">Settings</span>
      </div>
      <div className="relative mx-4 mt-2 mb-3">
        <IconSearch className="absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search..."
          className="h-9 w-full rounded-3xl border border-transparent bg-input/50 ps-8 pe-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {settingsSections.map((section) => (
          <button
            key={section.id}
            onClick={() => goToSection(section.id)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors hover:bg-muted"
          >
            <section.icon className="size-5 text-muted-foreground" />
            <span className="flex-1 text-start">{section.label}</span>
            <IconChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}
