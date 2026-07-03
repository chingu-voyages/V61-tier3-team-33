"use client"

import { ThemeProvider } from "@/components/theme/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GameProvider } from "@/context/GameProvider"
import { SessionProvider } from "@/context/SessionProvider"
import { SocketProvider } from "@/socket/socket-provider"
import { SocketDebugPanel } from "@/components/debug/SocketDebugPanel"
import { GooeyToaster } from "@/components/ui/goey-toaster"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "ws://localhost:3000"

// Everything here needs to be a Client Component (hooks, event handlers,
// context). Kept in one place and out of app/layout.tsx, which is a Server
// Component — Server Components can't pass functions as props into a
// Client Component, since props crossing that boundary have to be
// serializable.
//
// This component only bootstraps the tree now — it doesn't own any
// message-routing logic. Each provider (SessionProvider, GameProvider, the
// debug panel) subscribes to the socket independently via
// useSocketContext().onMessage.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <SocketProvider url={SOCKET_URL}>
          <SessionProvider>
            <GameProvider>
              {children}
              <GooeyToaster />
            </GameProvider>
            <SocketDebugPanel />
          </SessionProvider>
        </SocketProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
