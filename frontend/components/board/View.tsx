"use client"

import { useReducer, useCallback, useState, useMemo } from "react"
import { useGame } from "@/context/game/game-context"
import { useSocketEvent } from "@/socket/use-event"
import {
  POSITION_ACCEPTED,
  POSITION_REJECTED,
  MOVE_MADE,
  MOVE_REJECTED,
} from "@/socket/events"
import { Board } from "@/components/board/Board"
import { WHITE, BLACK } from "@/core/piece"
import { Position } from "@/core/position"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IconFlipHorizontal,
  IconArrowBackUp,
  IconFlag,
  IconCrown,
  IconX,
} from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlayerInfo } from "@/components/board/PlayerInfo"
import { viewReducer, INITIAL_VIEW } from "@/components/board/view-reducer"
import { FINISHED } from "@/socket/types"
import { DRAW } from "@/core/game"
import { Reason } from "@/core/reason"

interface ViewProps {
  onLeave: () => void
}

export function View({ onLeave }: ViewProps) {
  const { state, actions } = useGame()
  const [view, dispatch] = useReducer(viewReducer, INITIAL_VIEW)
  const [showResign, setShowResign] = useState(false)

  useSocketEvent(POSITION_ACCEPTED, (msg) => {
    dispatch({
      type: "ACCEPT_SELECTION",
      position: msg.position,
      moves: msg.moves,
    })
  })

  useSocketEvent(POSITION_REJECTED, () => {
    dispatch({ type: "CLEAR_SELECTION" })
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    dispatch({ type: "MOVE_MADE", from: msg.move.from, to: msg.move.to })
  })

  useSocketEvent(MOVE_REJECTED, () => {
    dispatch({ type: "CLEAR_SELECTION" })
  })

  const onSquareClick = useCallback(
    (pos: Position) => {
      if (state.status === FINISHED) return
      if (view.selected !== null && view.legalMoves.includes(pos)) {
        actions.makeMove({ from: view.selected, to: pos })
        return
      }
      actions.selectPosition(pos)
    },
    [view.selected, view.legalMoves, actions, state.status]
  )

  const confirmResign = useCallback(() => {
    setShowResign(false)
    actions.resign()
  }, [actions])

  const isFinished = state.status === FINISHED && state.result !== null

  const resultText = useMemo(() => {
    if (!state.result || state.color === null) return ""
    const { hasWinner, winner, status, reason, drawReason } = state.result
    if (hasWinner) {
      const iWon = winner === state.color
      return iWon ? "You won!" : "Opponent won!"
    }
    if (status === DRAW) {
      return Reason.drawLabel(drawReason)
    }
    return "Game Over"
  }, [state.result, state.color])

  if (state.color === null) return null

  const myColor = state.color
  const oppColor = myColor === WHITE ? BLACK : WHITE
  const baseFlipped = state.color === BLACK
  const boardFlipped = baseFlipped !== view.flipped

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6 lg:p-6">
      <div className="flex flex-col items-center gap-3">
        <PlayerInfo color={view.flipped ? myColor : oppColor} label={view.flipped ? "You" : "Opponent"} clock={state.clock} />

        <div className="relative">
          <Board board={state.board} view={{ ...view, flipped: boardFlipped }} onSquareClick={onSquareClick} />
          {isFinished && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/60 backdrop-blur-sm">
              {state.result!.hasWinner ? (
                <IconCrown className="size-16 text-yellow-400" />
              ) : (
                <IconX className="size-12 text-muted-foreground" />
              )}
              <p className="text-xl font-bold text-white">{resultText}</p>
              <Button variant="secondary" size="sm" onClick={onLeave}>
                Leave
              </Button>
            </div>
          )}
        </div>

        <PlayerInfo color={view.flipped ? oppColor : myColor} label={view.flipped ? "Opponent" : "You"} clock={state.clock} />

      </div>

      {!isFinished && (
        <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => dispatch({ type: "FLIP" })}
                >
                  <IconFlipHorizontal className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Flip board</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon" onClick={actions.requestUndo}>
                  <IconArrowBackUp className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Request undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon" onClick={() => setShowResign(true)}>
                  <IconFlag className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Resign</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Dialog open={showResign} onOpenChange={setShowResign}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Resign</DialogTitle>
            <DialogDescription>
              Are you sure you want to resign? This will end the game.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={confirmResign}>
              Resign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
