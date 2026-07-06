"use client"

import { IconArrowLeft } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useSettingsContext } from "@/context/settings/settings-context"
import { getSection } from "@/components/settings/settings-sections"

function SectionRenderer({ id }: { id: string }) {
  const section = getSection(id)
  if (!section) return null
  return <section.component />
}

export function MobileDetail() {
  const { state, goBackToList } = useSettingsContext()

  return (
    <div className="contents">
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <Button variant="ghost" size="icon" onClick={goBackToList}>
          <IconArrowLeft />
        </Button>
        <span className="font-heading text-base font-medium">
          {getSection(state.activeSection)?.label}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <SectionRenderer id={state.activeSection} />
      </div>
    </div>
  )
}
