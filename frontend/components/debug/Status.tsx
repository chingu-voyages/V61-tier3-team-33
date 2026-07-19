"use client"

import { cva } from "class-variance-authority"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SocketStatus } from "@/socket/reducer"

const dotVariants = cva("size-2 rounded-full", {
  variants: {
    status: {
      connecting: "bg-amber-500",
      open: "bg-emerald-500",
      closed: "bg-muted-foreground",
      reconnecting: "bg-amber-500",
      failed: "bg-destructive",
    } satisfies Record<SocketStatus, string>,
  },
})

export function ConnectionStatus({
  status,
  onReconnect,
}: {
  status: SocketStatus
  onReconnect: () => void
}) {
  return (
    <div className="flex items-center gap-2 border px-6 py-3">
      <span className={cn(dotVariants({ status }))} />
      <span className="font-mono text-xs uppercase">{status}</span>
      {status === "failed" && (
        <Button
          size="xs"
          variant="outline"
          onClick={onReconnect}
          className="ml-auto"
        >
          Reconnect
        </Button>
      )}
    </div>
  )
}
