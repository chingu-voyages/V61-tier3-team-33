"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  IconChess,
  IconPuzzle,
  IconBook,
  IconChartBar,
  IconMessage,
  IconUserHeart,
  IconSettings,
  IconUsers,
  IconSchool,
  IconLogout,
} from "@tabler/icons-react";

import { SettingsDialog } from "@/components/settings";
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
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


import { getPieceIcon } from "@/components/pieces";
import { WHITE, QUEEN } from "@/core/piece";

import { logout } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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
  {
    group: "Social",
    items: [
      { title: "Chat", url: "/chat", icon: IconMessage },
      { title: "Friends", url: "/friends", icon: IconUserHeart },
    ],
  },
];

export function AppSidebar() {
  const piece = { color: WHITE, type: QUEEN };

  const router = useRouter();
  const { user, refreshUser } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      await refreshUser();
      router.push("/");
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/" />}
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              {getPieceIcon(piece, {
                className: "size-5! [&_path]:fill-white",
              })}
              <span className="text-base font-semibold">
                Chingu Chess
              </span>
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
        {/* Settings */}
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

        {/* Current user */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="-ms-1.5 size-8 group-data-[collapsible=icon]:ms-0">
                <AvatarImage
                  src={`https://api.dicebear.com/9.x/initials/svg?seed=${
                    user?.username ?? "CC"
                  }`}
                  alt={user?.username ?? "Player"}
                />

                <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                  {(user?.username ?? "CC")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">
                  {user?.username ?? "Guest"}
                </span>

                <span className="truncate text-xs text-muted-foreground">
                  {user?.provider ?? "Guest"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Logout"
            >
              <IconLogout />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}