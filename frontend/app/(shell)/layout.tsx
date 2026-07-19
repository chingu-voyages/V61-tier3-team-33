import { AppHeader } from "@/components/main/AppHeader";
import { AppSidebar } from "@/components/main/AppSidebar";
import { SocketShell } from "@/components/main/SocketShell";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh">
        <AppHeader />
        <SocketShell>
          {children}
        </SocketShell>
      </SidebarInset>
    </SidebarProvider>
  );
}
