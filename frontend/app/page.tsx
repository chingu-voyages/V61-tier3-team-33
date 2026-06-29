import { AppHeader } from "@/components/main/AppHeader"
import { AppSidebar } from "@/components/main/AppSidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Page() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main />
      </SidebarInset>
    </SidebarProvider>
  )
}
