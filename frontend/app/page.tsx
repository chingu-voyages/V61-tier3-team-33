"use client"

import { AppHeader } from "@/components/main/AppHeader"
import { AppSidebar } from "@/components/main/AppSidebar"
import { Board } from "@/components/board/Board"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useGame } from "@/context/game/game-context"

export default function Page() {
  const { state } = useGame()
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex items-center justify-center p-4">
          <Board board={state.board} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
