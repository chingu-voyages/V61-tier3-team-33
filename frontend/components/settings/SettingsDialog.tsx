"use client"

import { Activity, type ReactElement } from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  IconArrowLeft,
  IconChevronRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import {
  settingsSections,
  getSection,
} from "@/components/settings/settings-sections"
import {
  SettingsProvider,
  useSettingsContext,
} from "@/components/settings/settings-context"
import { SettingsSidebar } from "@/components/settings/SettingsSidebar"

function SettingsSectionRenderer({ id }: { id: string }) {
  const section = getSection(id)
  if (!section) return null
  return <section.component />
}

function SettingsDesktop({ children }: { children: ReactElement }) {
  const { state } = useSettingsContext()

  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] min-h-[50vh] max-w-3xl min-w-2xl gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <SettingsSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex justify-end p-2">
            <DialogClose render={<Button variant="ghost" size="icon" />}>
              <IconX />
            </DialogClose>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <SettingsSectionRenderer id={state.activeSection} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingsMobile({ children }: { children: ReactElement }) {
  const { state, goToSection, goBackToList } = useSettingsContext()

  return (
    <Sheet>
      <SheetTrigger render={children} />
      <SheetContent
        showCloseButton={false}
        side="left"
        className="flex h-dvh max-h-dvh !w-full flex-col p-0"
      >
        <SheetTitle className="sr-only">Settings</SheetTitle>

        <Activity mode={state.mobileView === "list" ? "visible" : "hidden"}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-heading text-base font-medium">Settings</span>
            <SheetClose render={<Button variant="ghost" size="icon-sm" />}>
              <IconX />
            </SheetClose>
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
        </Activity>

        <Activity mode={state.mobileView === "detail" ? "visible" : "hidden"}>
          <div className="flex items-center gap-2 border-b px-2 py-2">
            <Button variant="ghost" size="icon" onClick={goBackToList}>
              <IconArrowLeft />
            </Button>
            <span className="font-heading text-base font-medium">
              {getSection(state.activeSection)?.label}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <SettingsSectionRenderer id={state.activeSection} />
          </div>
        </Activity>
      </SheetContent>
    </Sheet>
  )
}

export function SettingsDialog({ children }: { children: ReactElement }) {
  const isMobile = useIsMobile()

  return (
    <SettingsProvider>
      {isMobile ? (
        <SettingsMobile>{children}</SettingsMobile>
      ) : (
        <SettingsDesktop>{children}</SettingsDesktop>
      )}
    </SettingsProvider>
  )
}
