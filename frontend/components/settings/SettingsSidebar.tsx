"use client"

import { IconSearch } from "@tabler/icons-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { settingsSections } from "@/components/settings/settings-sections"
import { useSettingsContext } from "@/components/settings/settings-context"

export function SettingsSidebar() {
  const { state, goToSection } = useSettingsContext()

  return (
    <Sidebar collapsible="none" className="h-auto w-56 shrink-0 border-e">
      <div className="relative mx-3 mt-4 mb-2">
        <IconSearch className="absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <SidebarInput placeholder="Search..." className="ps-8" />
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsSections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    isActive={state.activeSection === section.id}
                    onClick={() => goToSection(section.id)}
                  >
                    <section.icon />
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
