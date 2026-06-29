import { SettingsDialog } from "@/components/settings"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  IconChess,
  IconPuzzle,
  IconBook,
  IconChartBar,
  IconSettings,
  IconUsers,
  IconSchool,
} from "@tabler/icons-react"
import Link from "next/link"
import { WhiteQueen } from "@/components/pieces"

const navItems = [
  {
    group: "Play",
    items: [
      { title: "Play", url: "/play", icon: IconChess },
      { title: "Puzzles", url: "/puzzles", icon: IconPuzzle },
    ],
  },
  {
    group: "Learn",
    items: [
      { title: "Coach", url: "/coach", icon: IconUsers },
      { title: "Train", url: "/train", icon: IconSchool },
      { title: "Lessons", url: "/lessons", icon: IconBook },
      { title: "Analysis", url: "/analysis", icon: IconChartBar },
    ],
  },
]

export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/" />}
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <WhiteQueen className="size-5! [&_path]:fill-white" />
              <span className="text-base font-semibold">Chingu Chess</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SettingsDialog>
              <SidebarMenuButton tooltip="Settings">
                <IconSettings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SettingsDialog>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="-ms-1.5 size-8 group-data-[collapsible=icon]:ms-0">
                <AvatarImage
                  src="https://api.dicebear.com/9.x/initials/svg?seed=CC"
                  alt="Player"
                />
                <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                  CC
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">Player</span>
                <span className="truncate text-xs text-muted-foreground">
                  player@chinguchess.com
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
