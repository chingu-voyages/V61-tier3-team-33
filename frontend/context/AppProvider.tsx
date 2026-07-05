"use client"

import { ThemeProvider } from "@/components/theme/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SocketProvider } from "@/socket/provider"
import { GameProvider } from "@/context/GameProvider"
import { DebugPanel } from "@/components/debug/DebugPanel"
import { env } from "@/config/env"

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <SocketProvider url={env.socketUrl}>
          <GameProvider>
            {children}
            <DebugPanel />
          </GameProvider>
        </SocketProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
