import Link from "next/link"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { IconBell } from "@tabler/icons-react"

const headerItems = [
  { title: "Notifications", url: "/notifications", icon: IconBell },
]

export function AppHeader() {
  return (
    <header className="flex items-center gap-1 border-b px-2 py-1.5">
      <SidebarTrigger size="icon" />
      <div className="ml-auto flex items-center gap-1">
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
      </div>
    </header>
  )
}
