"use client"

import type { ReactElement } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IconX } from "@tabler/icons-react"
import { useSettingsContext } from "@/context/settings/settings-context"
import { getSection } from "@/components/settings/settings-sections"
import { Sidebar } from "./Sidebar"

function SectionRenderer({ id }: { id: string }) {
  const section = getSection(id)
  if (!section) return null
  return <section.component />
}

export function Desktop({ children }: { children: ReactElement }) {
  const { state } = useSettingsContext()

  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] min-h-[50vh] max-w-3xl min-w-2xl gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex justify-end p-2">
            <DialogClose render={<Button variant="ghost" size="icon" />}>
              <IconX />
            </DialogClose>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <SectionRenderer id={state.activeSection} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
