"use client"

import { AppHeader } from "@/components/main/AppHeader"
import { AppSidebar } from "@/components/main/AppSidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh">
        <AppHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
