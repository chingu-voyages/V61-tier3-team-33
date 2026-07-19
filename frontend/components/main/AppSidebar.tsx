"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  IconChess,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import { FriendsIcon } from "../icons/google";

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
import { Spinner } from "@/components/ui/spinner";

import { getPieceIcon } from "@/components/pieces";
import { WHITE, QUEEN } from "@/core/piece";
import { useAuth } from "@/components/auth/use-auth";
import { useGuest } from "@/context/guest/GuestProvider";

const navItems = [
  {
    group: "Play",
    items: [
      { title: "Play", url: "/play", icon: IconChess },
    ],
  },
  {
    group: "Social",
    items: [
      { title: "Friends", url: "/friends", icon: FriendsIcon },
    ],
  },
];

export function AppSidebar() {
  const piece = { color: WHITE, type: QUEEN };
  const { user, loading, logout } = useAuth();
  const { isGuest, clearGuest } = useGuest();
  const router = useRouter();
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "CC";

  function handleGuestSignIn() {
    clearGuest();
    router.push("/login");
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SettingsDialog>
                  <SidebarMenuButton tooltip="Settings">
                    <IconSettings />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SettingsDialog>
              </SidebarMenuItem>

              {user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Logout"
                    onClick={() => logout.submit()}
                    disabled={logout.loading}
                  >
                    {logout.loading ? <Spinner /> : <IconLogout />}
                    <span>Logout</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem className="mt-2">
                <SidebarMenuButton
                  size="lg"
                  onClick={isGuest ? handleGuestSignIn : undefined}
                >
                  <Avatar className="-ms-1.5 size-8 group-data-[collapsible=icon]:ms-0">
                    <AvatarImage
                      src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user?.username ?? "CC")}`}
                      alt={user?.username ?? "Player"}
                    />
                    <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    {loading ? (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Spinner /> Loading...
                      </span>
                    ) : user ? (
                      <>
                        <span className="truncate font-medium">{user.username}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </>
                    ) : (
                      <>
                        <span className="truncate font-medium">Guest</span>
                        <span className="truncate text-xs text-muted-foreground">Not signed in</span>
                      </>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
