"use client"

import { useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { QuickSend, type QuickCommand } from "./QuickSend"

export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean
  onSend: (payload: object) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('{\n  "type": ""\n}')
  const [error, setError] = useState<string | null>(null)

  function handleSend() {
    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch {
      setError("Invalid JSON")
      return
    }
    if (typeof parsed !== "object" || parsed === null) {
      setError("Must be a JSON object")
      return
    }
    onSend(parsed as object)
    setError(null)
  }

  function handleQuickCommand(cmd: QuickCommand) {
    if (cmd.immediate) {
      onSend(cmd.payload)
      return
    }
    setDraft(JSON.stringify(cmd.payload, null, 2))
    setError(null)
    setOpen(true)
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground">
          Send a command
          <IconChevronDown className="size-3.5 transition-transform group-aria-expanded:rotate-180" />
        </CollapsibleTrigger>
        <QuickSend onPick={handleQuickCommand} />
      </div>
      <CollapsibleContent className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-md border bg-background p-2 font-mono text-xs"
          placeholder='{"type": "move:make", "from": 1, "to": 2}'
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={handleSend} disabled={disabled}>
          Send
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
