"use client"

import { GooeyToaster } from "@/components/ui/goey-toaster"
import { ThemeProvider } from "@/context/theme/ThemeProvider"
import { ChessThemeProvider } from "@/context/theme/ChessThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SocketProvider } from "@/socket/provider"
import { SessionProvider } from "@/context/session/SessionProvider"
import { GameProvider } from "@/context/game/GameProvider"
import { DebugPanel } from "@/components/debug/DebugPanel"
import { env } from "@/config/env"

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ChessThemeProvider>
        <TooltipProvider>
          <GooeyToaster position="top-right" closeButton showProgress />
          <SocketProvider url={env.socketUrl}>
            <SessionProvider>
              <GameProvider>
                {children}
                <DebugPanel />
              </GameProvider>
            </SessionProvider>
          </SocketProvider>
        </TooltipProvider>
      </ChessThemeProvider>
    </ThemeProvider>
  )
}
