"use client"

import { useEffect, useRef } from "react"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { useSocketContext } from "@/socket/context"
import type { SocketStatus } from "@/socket/reducer"

const TOAST_ID = "connection-status"

const PERSISTENT_DURATION_MS = 24 * 60 * 60 * 1000 // 24h

type ToastType = "info" | "warning" | "error"
type ToastAction = { label: string; onClick: () => void }

function tryingCopy(hasEverOpened: boolean, attempt: number) {
  const suffix = attempt > 1 ? ` (attempt ${attempt})` : ""

  return hasEverOpened
    ? {
        title: "Reconnecting",
        description: `Attempting to reconnect...${suffix}`,
      }
    : {
        title: "Connecting",
        description: `Attempting to connect...${suffix}`,
      }
}

function failedCopy(hasEverOpened: boolean) {
  return hasEverOpened
    ? {
        title: "Disconnected",
        description: "Unable to reconnect. Please refresh or try again.",
      }
    : {
        title: "Connection failed",
        description: "Unable to connect. Please refresh or try again.",
      }
}

export function useConnection() {
  const { status, attempt, reconnect } = useSocketContext()
  const prevStatus = useRef<SocketStatus | null>(null)
  const toastCreated = useRef(false)
  const hasEverOpened = useRef(false)
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearPatchTimer = () => {
      if (!patchTimer.current) return
      clearTimeout(patchTimer.current)
      patchTimer.current = null
    }

    const create = (
      type: ToastType,
      title: string,
      description: string,
      action?: ToastAction
    ) => {
      gooeyToast[type](title, {
        id: TOAST_ID,
        description,
        action,
        timing: { displayDuration: PERSISTENT_DURATION_MS },
        showProgress: false,
        onDismiss: () => {
          toastCreated.current = false
        },
      })
      toastCreated.current = true
    }

    const patch = (
      type: ToastType,
      title: string,
      description: string,
      action?: ToastAction
    ) => {
      if (!toastCreated.current) {
        create(type, title, description, action)
        return
      }

      const opts = { title, description, type, action }
      gooeyToast.update(TOAST_ID, opts)

      clearPatchTimer()
      patchTimer.current = setTimeout(() => {
        gooeyToast.update(TOAST_ID, opts)
        patchTimer.current = null
      }, 0)
    }

    const dismiss = () => {
      clearPatchTimer()
      gooeyToast.dismiss(TOAST_ID)
      toastCreated.current = false
    }

    const prev = prevStatus.current
    prevStatus.current = status

    if (prev === status && status !== "reconnecting") return

    switch (status) {
      case "connecting": {
        if (prev === "failed") {
          dismiss()
        }

        if (!toastCreated.current) {
          const copy = hasEverOpened.current
            ? {
                title: "Reconnecting",
                description: "Attempting to reconnect...",
              }
            : {
                title: "Connecting",
                description: "Establishing connection...",
              }

          create("info", copy.title, copy.description)
        }
        break
      }

      case "reconnecting": {
        const { title, description } = tryingCopy(hasEverOpened.current, attempt)
        patch("warning", title, description)
        break
      }

      case "failed": {
        const { title, description } = failedCopy(hasEverOpened.current)
        patch("error", title, description, {
          label: "Retry",
          onClick: () => reconnect(),
        })
        break
      }

      case "open": {
        hasEverOpened.current = true
        dismiss()
        break
      }

      case "closed": {
        dismiss()
        break
      }
    }

    return () => {
      clearPatchTimer()
    }
  }, [status, attempt, reconnect])
}
