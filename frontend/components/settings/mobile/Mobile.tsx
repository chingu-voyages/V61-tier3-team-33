"use client"

import { Activity, type ReactElement } from "react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useSettingsContext } from "@/context/settings/settings-context"
import { MobileList } from "./MobileList"
import { MobileDetail } from "./MobileDetail"

export function Mobile({ children }: { children: ReactElement }) {
  const { state } = useSettingsContext()

  return (
    <Sheet>
      <SheetTrigger render={children} />
      <SheetContent
        showCloseButton={false}
        side="left"
        className="flex h-dvh max-h-dvh w-(--sidebar-width) flex-col p-0 data-[side=left]:w-(--sidebar-width) max-[480px]:w-full!"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <SheetTitle className="sr-only">Settings</SheetTitle>
        <Activity mode={state.mobileView === "list" ? "visible" : "hidden"}>
          <MobileList />
        </Activity>
        <Activity mode={state.mobileView === "detail" ? "visible" : "hidden"}>
          <MobileDetail />
        </Activity>
      </SheetContent>
    </Sheet>
  )
}
