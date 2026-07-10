"use client"

import { IconBug, IconTrash } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"

import { useDebugPanel } from "./use-debug"
import { LogEntry, EmptyLog } from "./Entry"
import { ConnectionStatus } from "./Status"
import { Composer } from "./Composer"

export function DebugPanel() {
  if (process.env.NODE_ENV === "production") return null
  return <DebugPanelInner />
}

function DebugPanelInner() {
  const { status, reconnect, log, sendPayload, clear } = useDebugPanel()

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="secondary"
            size="icon-lg"
            aria-label="Open socket debug panel"
            className="fixed right-4 bottom-4 z-40 shadow-lg"
          >
            <IconBug />
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>Socket debug</SheetTitle>
          <SheetDescription>Debug transport layer.</SheetDescription>
        </SheetHeader>

        <ConnectionStatus status={status} onReconnect={reconnect} />

        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Traffic ({log.length})
            </span>
            {log.length > 0 && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={clear}
                aria-label="Clear log"
              >
                <IconTrash />
              </Button>
            )}
          </div>

          <ul className="mt-2 space-y-1">
            {log.length === 0 && (
              <li>
                <EmptyLog />
              </li>
            )}
            {log.map((entry) => (
              <li key={entry.id}>
                <LogEntry entry={entry} />
              </li>
            ))}
          </ul>
        </div>

        <SheetFooter>
          <Composer disabled={status !== "open"} onSend={sendPayload} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
