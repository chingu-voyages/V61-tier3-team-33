"use client";

import Link from "next/link";

import {
  IconBell,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const headerItems = [
  {
    title: "Notifications",
    url: "/notifications",
    icon: IconBell,
  },
];

export function AppHeader() {
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
      </div>
    </header>
  );
}
