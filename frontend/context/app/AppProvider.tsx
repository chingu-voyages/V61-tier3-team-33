"use client"

import { GooeyToaster } from "@/components/ui/goey-toaster"
import { ThemeProvider } from "@/context/theme/ThemeProvider"
import { ChessThemeProvider } from "@/context/theme/ChessThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SocketProvider } from "@/socket/provider"
import { SessionProvider } from "@/context/session/SessionProvider"
import { RoomProvider } from "@/context/room/provider"
import { ChessProvider } from "@/chess/provider"
import { DebugPanel } from "@/components/debug/DebugPanel"
import { env } from "@/config/env"

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ChessThemeProvider>
        <TooltipProvider>
          <GooeyToaster position="top-center" closeButton="top-right" showProgress />
          <SocketProvider url={env.socketUrl}>
            <SessionProvider>
              <RoomProvider>
                <ChessProvider>
                  {children}
                  <DebugPanel />
                </ChessProvider>
              </RoomProvider>
            </SessionProvider>
          </SocketProvider>
        </TooltipProvider>
      </ChessThemeProvider>
    </ThemeProvider>
  )
}