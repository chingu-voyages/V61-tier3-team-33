"use client"

import { cva, type VariantProps } from "class-variance-authority"
import {
  IconChevronDown,
  IconCopy,
  IconMessageCircle,
} from "@tabler/icons-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LogEntry as LogEntryData } from "./reducer"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const arrowVariants = cva("shrink-0 font-mono", {
  variants: {
    variant: {
      in: "text-emerald-600",
      out: "text-blue-600",
    },
  },
})

function copy(data: unknown) {
  navigator.clipboard.writeText(JSON.stringify(data, null, 2))
}

function messageType(data: unknown): string {
  if (typeof data === "object" && data !== null && "type" in data) {
    const { type } = data as { type: unknown }
    if (typeof type === "string") return type
  }
  return "(untyped)"
}

export function LogEntry({ entry }: { entry: LogEntryData }) {
  const variant: VariantProps<typeof arrowVariants>["variant"] =
    entry.direction === "in" ? "in" : "out"

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs",
          "hover:bg-muted/50"
        )}
      >
        <span className={cn(arrowVariants({ variant }))}>
          {entry.direction === "in" ? "←" : "→"}
        </span>
        <span className="truncate font-mono font-medium">
          {messageType(entry.data)}
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground">
          {new Date(entry.at).toLocaleTimeString()}
        </span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative mt-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy JSON"
            className="absolute top-1.5 right-1.5"
            onClick={() => copy(entry.data)}
          >
            <IconCopy />
          </Button>
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 pe-8 font-mono text-xs break-all whitespace-pre-wrap">
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function EmptyLog() {
  return (
    <Empty className="p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconMessageCircle />
        </EmptyMedia>
        <EmptyTitle>No messages yet</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
