"use client"

import { DebugPanel } from "@/components/debug/DebugPanel"
import { SocketProvider } from "@/socket/provider"
import { SessionProvider } from "@/context/session/SessionProvider"
import { RoomProvider } from "@/context/room/provider"
import { ChessProvider } from "@/chess/provider"
import { env } from "@/config/env"

export function SocketShell({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
