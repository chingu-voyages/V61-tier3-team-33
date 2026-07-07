"use client"

import { AppHeader } from "@/components/main/AppHeader"
import { AppSidebar } from "@/components/main/AppSidebar"
import { MainPage } from "@/components/main/MainPage"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Page() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh">
        <AppHeader />
        <MainPage />
      </SidebarInset>
    </SidebarProvider>
  )
}
