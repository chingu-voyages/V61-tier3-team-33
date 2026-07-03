"use client"

import { AppHeader } from "@/components/main/AppHeader"
import { AppSidebar } from "@/components/main/AppSidebar"
import { Play } from "@/components/play/Play"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Page() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 items-center justify-center p-4">
          <Play />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
