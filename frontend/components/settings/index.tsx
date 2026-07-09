"use client"

import type { ReactElement } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { SettingsProvider } from "@/context/settings/SettingsProvider"
import { Desktop } from "./desktop/Desktop"
import { Mobile } from "./mobile/Mobile"

export function SettingsDialog({ children }: { children: ReactElement }) {
  const isMobile = useIsMobile()

  return (
    <SettingsProvider>
      {isMobile ? <Mobile>{children}</Mobile> : <Desktop>{children}</Desktop>}
    </SettingsProvider>
  )
}
