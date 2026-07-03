"use client"

import * as React from "react"
import {
  IconBug,
  IconChevronDown,
  IconSend2,
  IconTrash,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useSocketContext } from "@/socket/socket-provider"
import type { SocketStatus } from "@/socket/socket-reducer"
import { Commands, EASY, HUMAN_VS_AI, HUMAN_VS_HUMAN } from "@/socket/commands"
import { Position } from "@/lib/core/position"

const MAX_LOG_ENTRIES = 50

const STATUS_DOT: Record<SocketStatus, string> = {
  connecting: "bg-amber-500",
  open: "bg-emerald-500",
  closed: "bg-muted-foreground",
  reconnecting: "bg-amber-500",
  failed: "bg-destructive",
}

interface LogEntry {
  id: number
  direction: "in" | "out"
  data: unknown
  at: number
}

/**
 * Preset commands for the "quick send" menu. `immediate` ones need no
 * parameters, so clicking sends them straight away. Everything else just
 * seeds the draft textarea — e.g. join/move need a roomId or square that
 * only makes sense once you're actually looking at a live room — so you
 * can tweak values before hitting Send.
 */
const QUICK_COMMANDS: { label: string; payload: object; immediate: boolean }[] =
  [
    { label: "Handshake", payload: Commands.handshake(), immediate: false },
    {
      label: "Join room · Human vs Human",
      payload: Commands.joinRoom({ mode: HUMAN_VS_HUMAN }),
      immediate: false,
    },
    {
      label: "Join room · Human vs AI (easy)",
      payload: Commands.joinRoom({ mode: HUMAN_VS_AI, difficulty: EASY }),
      immediate: false,
    },
    { label: "Leave room", payload: Commands.leaveRoom(), immediate: true },
    {
      label: "Move",
      payload: Commands.makeMove({ from: Position(8), to: Position(16) }),
      immediate: false,
    },
    { label: "Request undo", payload: Commands.requestUndo(), immediate: true },
    { label: "Accept undo", payload: Commands.acceptUndo(), immediate: true },
    { label: "Decline undo", payload: Commands.declineUndo(), immediate: true },
    { label: "Resign", payload: Commands.resign(), immediate: true },
    { label: "Sync state", payload: Commands.syncState(), immediate: true },
    { label: "Pong", payload: Commands.pong(), immediate: true },
  ]

function messageType(data: unknown): string {
  if (typeof data === "object" && data !== null && "type" in data) {
    const { type } = data as { type: unknown }
    if (typeof type === "string") return type
  }
  return "(untyped)"
}

// Dev-only. Floating trigger + sheet for poking at the socket connection:
// see live status, force a reconnect once failed, fire raw JSON commands
// (or a preset from the quick-send menu), and watch real inbound traffic
// as a collapsible in/out log — one line per message, expand for the full
// payload.
export function SocketDebugPanel() {
  if (process.env.NODE_ENV === "production") return null
  return <SocketDebugPanelInner />
}

function SocketDebugPanelInner() {
  const { status, send, reconnect, onMessage } = useSocketContext()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState('{\n  "type": ""\n}')
  const [error, setError] = React.useState<string | null>(null)
  const [log, setLog] = React.useState<LogEntry[]>([])
  const nextId = React.useRef(0)

  const appendLog = React.useCallback(
    (direction: LogEntry["direction"], data: unknown) => {
      setLog((prev) =>
        [
          { id: nextId.current++, direction, data, at: Date.now() },
          ...prev,
        ].slice(0, MAX_LOG_ENTRIES)
      )
    },
    []
  )

  React.useEffect(() => {
    return onMessage((raw) => appendLog("in", raw))
  }, [onMessage, appendLog])

  const sendPayload = (payload: object) => {
    send(payload)
    setError(null)
    appendLog("out", payload)
  }

  const handleSend = () => {
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

    sendPayload(parsed as object)
  }

  const handleQuickCommand = (cmd: (typeof QUICK_COMMANDS)[number]) => {
    if (cmd.immediate) {
      sendPayload(cmd.payload)
      return
    }
    setDraft(JSON.stringify(cmd.payload, null, 2))
    setError(null)
  }

  return (
    <>
      <Button
        variant="secondary"
        size="icon-lg"
        aria-label="Open socket debug panel"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 shadow-lg"
      >
        <IconBug />
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
            STATUS_DOT[status]
          )}
        />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Socket debug</SheetTitle>
            <SheetDescription>
              Dev-only panel. Not rendered in production builds.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 px-6">
            <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
            <span className="font-mono text-xs uppercase">{status}</span>
            {status === "failed" && (
              <Button
                size="xs"
                variant="outline"
                onClick={reconnect}
                className="ml-auto"
              >
                Reconnect
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Traffic ({log.length})
              </span>
              {log.length > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setLog([])}
                  aria-label="Clear log"
                >
                  <IconTrash data-icon="inline-start" />
                  Clear
                </Button>
              )}
            </div>

            <ul className="mt-2 space-y-1">
              {log.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  No messages yet.
                </li>
              )}
              {log.map((entry) => (
                <li key={entry.id}>
                  <Collapsible>
                    <CollapsibleTrigger
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs",
                        "hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 font-mono",
                          entry.direction === "in"
                            ? "text-emerald-600"
                            : "text-blue-600"
                        )}
                      >
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
                      <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-xs break-all whitespace-pre-wrap">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              ))}
            </ul>
          </div>

          <SheetFooter className="gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Send a command
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="xs" variant="outline">
                      <IconSend2 data-icon="inline-start" />
                      Quick send
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <div className="px-3 py-1.5 text-xs text-muted-foreground">
                    Fires immediately
                  </div>
                  {QUICK_COMMANDS.filter((c) => c.immediate).map((cmd) => (
                    <DropdownMenuItem
                      key={cmd.label}
                      onClick={() => handleQuickCommand(cmd)}
                    >
                      {cmd.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="px-3 py-1.5 text-xs text-muted-foreground">
                    Fills the editor below
                  </div>
                  {QUICK_COMMANDS.filter((c) => !c.immediate).map((cmd) => (
                    <DropdownMenuItem
                      key={cmd.label}
                      onClick={() => handleQuickCommand(cmd)}
                    >
                      {cmd.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full rounded-md border bg-background p-2 font-mono text-xs"
              placeholder='{"type": "move:make", "from": 1, "to": 2}'
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={handleSend} disabled={status !== "open"}>
              Send
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
