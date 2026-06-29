import type { ComponentType } from "react"

import { IconPalette, IconShield, IconSettings, IconUser } from "@tabler/icons-react"

import { AccountPage } from "@/components/settings/pages/AccountPage"
import { AppearancePage } from "@/components/settings/pages/AppearancePage"
import { GameplayPage } from "@/components/settings/pages/GameplayPage"
import { ProfilePage } from "@/components/settings/pages/ProfilePage"

export interface SettingsSection {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  component: ComponentType
}

export const settingsSections: SettingsSection[] = [
  { id: "profile", label: "Profile", icon: IconUser, component: ProfilePage },
  {
    id: "appearance",
    label: "Appearance",
    icon: IconPalette,
    component: AppearancePage,
  },
  {
    id: "gameplay",
    label: "Gameplay",
    icon: IconSettings,
    component: GameplayPage,
  },
  { id: "account", label: "Account", icon: IconShield, component: AccountPage },
]

export function getSection(id: string) {
  return settingsSections.find((s) => s.id === id)
}
