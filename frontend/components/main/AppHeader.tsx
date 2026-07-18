"use client";

import Link from "next/link";

import {
  IconBell,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import { useAuth } from "@/hooks/useAuth";

const headerItems = [
  {
    title: "Notifications",
    url: "/notifications",
    icon: IconBell,
  },
];

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="flex items-center gap-2 border-b px-4 py-2">
      <SidebarTrigger size="icon" />

      <div className="ml-auto flex items-center gap-2">
        {headerItems.map((item) => (
          <Button
            key={item.title}
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<Link href={item.url} />}
          >
            <item.icon />
          </Button>
        ))}

        <ThemeToggle />

        {user && (
          <div className="flex items-center gap-2 rounded-lg px-2 py-1">
            <Avatar className="size-8">
              <AvatarImage
                src={`https://api.dicebear.com/9.x/initials/svg?seed=${user.username}`}
                alt={user.username}
              />

              <AvatarFallback>
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <span className="hidden text-sm font-medium md:block">
              {user.username}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}