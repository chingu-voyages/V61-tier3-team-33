"use client"

import { IconFlag } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

interface ResignButtonProps {
  onConfirm: () => void
}

/**
 * The resign action on GameScreen, gated behind a confirmation dialog —
 * resigning ends the game immediately and can't be undone, so a stray
 * click shouldn't be able to trigger it on its own.
 */
export function ResignButton({ onConfirm }: ResignButtonProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <IconFlag data-icon="inline-start" />
        Resign
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resign this game?</DialogTitle>
          <DialogDescription>
            Your opponent will win immediately. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" onClick={onConfirm} />}
          >
            Resign
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
